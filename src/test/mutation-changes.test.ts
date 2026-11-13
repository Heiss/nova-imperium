import { globSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import vitestConfig from '../../vitest.config.ts';
import {
  isMutated,
  main,
  MUTATION_CONFIG,
  reason,
  reasons,
  TEST_FILES,
  toolChain,
  toolChainReason,
} from '../../scripts/mutation-changes.ts';
import { mutatedFiles } from '../../scripts/mutation-shards.ts';

const stryker = JSON.parse(readFileSync('stryker.config.json', 'utf8'));
const mutate: string[] = stryker.mutate;

/** A pnpm lockfile (version 9) with the given packages. */
const lockfile = (...packages: string[]): string =>
  [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    devDependencies:',
    '      vitest:',
    '        specifier: ^9.9.9',
    '        version: 9.9.9',
    '',
    'packages:',
    '',
    ...packages.flatMap((p) => [
      `  ${p}:`,
      '    resolution: {integrity: sha512-x}',
      '',
    ]),
    'snapshots:',
    '',
    '  vitest@8.8.8(typescript@8.8.8):',
    '    dependencies:',
    '      typescript: 8.8.8',
    '',
  ].join('\n');

const tools = [
  "'@stryker-mutator/core@10.1.1'",
  "'@stryker-mutator/vitest-runner@10.1.1'",
  'typescript@6.0.3',
  'vitest@5.1.0',
];
const LOCK = lockfile(
  ...tools,
  "'@vitest/spy@5.1.0'",
  'typescript-eslint@8.72.2',
);

/** A git with fixed answers; a command it does not know fails. */
const fakeGit =
  (answers: Record<string, string>) =>
  (args: string[]): string => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) throw new Error(`git ${args.join(' ')}`);
    return answer;
  };
const diff = 'diff --name-only -z --no-renames base head';

describe('mutation changes: the files', () => {
  it('applies the mutate patterns in order; the last match decides', () => {
    const patterns = ['src/a/**/*.ts', '!**/*.test.ts', '!src/a/b/**'];
    expect(isMutated('src/a/x.ts', patterns)).toBe(true);
    expect(isMutated('src/a/c/x.ts', patterns)).toBe(true);
    expect(isMutated('src/a/x.test.ts', patterns)).toBe(false);
    expect(isMutated('src/a/b/y.ts', patterns)).toBe(false);
    expect(isMutated('src/c/z.ts', patterns)).toBe(false);
    expect(isMutated('src/a/b/y.ts', [...patterns, 'src/a/b/y.ts'])).toBe(true);
    expect(isMutated('src/a/x.ts', [])).toBe(false);
  });

  it('agrees with the files the mutation plan lists (stryker.config.json)', () => {
    const planned = new Set(mutatedFiles(mutate));
    const all = globSync('src/**/*').map((f) => f.split('\\').join('/'));
    expect(all.length).toBeGreaterThan(planned.size);
    for (const file of all)
      expect([file, isMutated(file, mutate)]).toEqual([
        file,
        planned.has(file),
      ]);
  });

  it('names a mutated file, a test file and the mutation configuration', () => {
    expect(reason('src/core/economy.ts', mutate)).toBe(
      'src/core/economy.ts is mutated (stryker.config.json)',
    );
    expect(reason('src/core/economy.test.ts', mutate)).toBe(
      'src/core/economy.test.ts is a test file',
    );
    for (const file of [
      'src/test/fixtures.ts',
      'src/test/legacy/game.cjs',
      'src/server/test-helpers.ts',
    ])
      expect(reason(file, mutate)).toBe(`${file} is a test file`);
    for (const file of [
      'stryker.config.json',
      'mutation-standard.json',
      'vitest.config.ts',
      'scripts/mutation-gate.ts',
      'scripts/mutation-shards.ts',
      'scripts/mutation-changes.ts',
      'tsconfig.json',
    ])
      expect(reason(file, mutate)).toBe(`${file} configures the mutation run`);
  });

  it('leaves out what changes neither the mutants nor the tests', () => {
    for (const file of [
      'package.json',
      'pnpm-lock.yaml',
      'Dockerfile',
      'renovate.json',
      '.github/workflows/ci.yml',
      'src/core/texts.ts',
      'src/server/main.ts',
      'src/server/cli.ts',
      'src/client/views/Galaxy.svelte',
      'src/client/main.ts',
      'src/features/index.gen.ts',
      'e2e/game.spec.ts',
      'scripts/changelog.ts',
      'okf/ops/testing.md',
      'changes/x.md',
      'README.md',
    ])
      expect([file, reason(file, mutate)]).toEqual([file, undefined]);
  });

  it('counts every file Vitest runs as a test file (vitest.config.ts)', () => {
    const include = vitestConfig.test?.include ?? [];
    expect(include.length).toBeGreaterThan(0);
    for (const pattern of include) expect(TEST_FILES).toContain(pattern);
  });

  it('counts every mutation script as configuration', () => {
    const scripts = globSync('scripts/mutation-*.ts');
    expect(scripts.length).toBe(3);
    for (const file of scripts.map((f) => f.split('\\').join('/')))
      expect(reason(file, mutate)).toBe(`${file} configures the mutation run`);
    expect(MUTATION_CONFIG).toContain('scripts/mutation-*.ts');
  });
});

describe('mutation changes: the test tool chain', () => {
  it('reads the versions of Stryker, Vitest and TypeScript from the packages', () => {
    expect(toolChain(LOCK)).toEqual([
      '@stryker-mutator/core@10.1.1',
      '@stryker-mutator/vitest-runner@10.1.1',
      'typescript@6.0.3',
      'vitest@5.1.0',
    ]);
    expect(toolChain('')).toEqual([]);
    expect(toolChain(lockfile(...[...tools].reverse()))).toEqual(
      toolChain(LOCK),
    );
  });

  it('reads only the keys of the section "packages"', () => {
    const outside = '  vitest@7.7.7:\n\nimporters:\n\n  typescript@7.7.7:\n';
    expect(toolChain(outside + LOCK)).toEqual(toolChain(LOCK));
    const nested = LOCK.replace(
      'packages:\n',
      'packages:\n\n    vitest@7.7.7:\n',
    );
    expect(toolChain(nested)).toEqual(toolChain(LOCK));
  });

  it('reads the real lockfile', () => {
    const found = toolChain(readFileSync('pnpm-lock.yaml', 'utf8'));
    const core = (
      JSON.parse(readFileSync('package.json', 'utf8')) as {
        devDependencies: Record<string, string>;
      }
    ).devDependencies['@stryker-mutator/core'];
    expect(found).toContain(`@stryker-mutator/core@${core}`);
    expect(found.some((v) => v.startsWith('vitest@'))).toBe(true);
    expect(found.some((v) => v.startsWith('typescript@'))).toBe(true);
    expect(found.every((v) => !v.includes('('))).toBe(true);
  });

  it('runs the jobs when a version is added, removed or replaced', () => {
    expect(toolChainReason(LOCK, LOCK)).toBeUndefined();
    const newer = LOCK.replace('vitest@5.1.0', 'vitest@5.2.0');
    expect(toolChainReason(LOCK, newer)).toBe(
      'pnpm-lock.yaml changes the test tool chain: -vitest@5.1.0 +vitest@5.2.0',
    );
    const both = lockfile(...tools, 'typescript@7.0.2');
    expect(toolChainReason(lockfile(...tools), both)).toBe(
      'pnpm-lock.yaml changes the test tool chain: +typescript@7.0.2',
    );
    expect(toolChainReason(both, lockfile(...tools))).toBe(
      'pnpm-lock.yaml changes the test tool chain: -typescript@7.0.2',
    );
    expect(toolChainReason('', LOCK)).toBe(
      'pnpm-lock.yaml changes the test tool chain: +@stryker-mutator/core@10.1.1 +@stryker-mutator/vitest-runner@10.1.1 +typescript@6.0.3 +vitest@5.1.0',
    );
  });

  it('ignores other packages, peers and the importers', () => {
    const other = lockfile(
      ...tools,
      "'@vitest/spy@5.9.0'",
      'typescript-eslint@9.0.0',
      'left-pad@1.0.0',
    )
      .replace(
        'vitest@8.8.8(typescript@8.8.8)',
        'vitest@5.1.0(typescript@6.0.3)',
      )
      .replace('version: 9.9.9', 'version: 9.9.8');
    expect(toolChainReason(LOCK, other)).toBeUndefined();
  });

  it('fails when the new lockfile names no version of a tool', () => {
    expect(() => toolChainReason(LOCK, lockfile(...tools.slice(2)))).toThrow(
      'pnpm-lock.yaml names no version of @stryker-mutator/*: cannot tell whether the test tool chain changed.',
    );
    expect(() => toolChainReason(LOCK, '')).toThrow(
      'names no version of @stryker-mutator/*, vitest, typescript:',
    );
  });
});

describe('mutation changes: the diff', () => {
  it('skips a change of dependencies and the Dockerfile', () => {
    const git = fakeGit({
      [diff]: 'Dockerfile\0package.json\0pnpm-lock.yaml\0',
      'show base:pnpm-lock.yaml': LOCK,
      'show head:pnpm-lock.yaml': LOCK.replace(
        'packages:\n',
        'packages:\n\n  left-pad@1.0.0:\n',
      ),
    });
    expect(reasons('base', 'head', mutate, git)).toEqual([]);
  });

  it('lists every reason: files and the tool chain', () => {
    const git = fakeGit({
      [diff]:
        'README.md\0src/core/economy.ts\0src/old.test.ts\0pnpm-lock.yaml\0',
      'show base:pnpm-lock.yaml': LOCK,
      'show head:pnpm-lock.yaml': LOCK.replace(
        "'@stryker-mutator/core@10.1.1'",
        "'@stryker-mutator/core@10.2.0'",
      ),
    });
    expect(reasons('base', 'head', mutate, git)).toEqual([
      'src/core/economy.ts is mutated (stryker.config.json)',
      'src/old.test.ts is a test file',
      'pnpm-lock.yaml changes the test tool chain: -@stryker-mutator/core@10.1.1 +@stryker-mutator/core@10.2.0',
    ]);
  });

  it('reads paths with unusual characters unquoted (NUL-delimited)', () => {
    const git = fakeGit({ [diff]: 'src/test/\u00e4 b.ts\0' });
    expect(reasons('base', 'head', mutate, git)).toEqual([
      'src/test/\u00e4 b.ts is a test file',
    ]);
  });

  it('reads the lockfiles only when the lockfile changed', () => {
    const git = fakeGit({ [diff]: 'src/client/views/Galaxy.svelte\0' });
    expect(reasons('base', 'head', mutate, git)).toEqual([]);
    expect(reasons('base', 'head', mutate, fakeGit({ [diff]: '' }))).toEqual(
      [],
    );
  });

  it('takes a lockfile missing before the change as empty', () => {
    const git = fakeGit({
      [diff]: 'pnpm-lock.yaml\0',
      'show head:pnpm-lock.yaml': LOCK,
    });
    expect(reasons('base', 'head', mutate, git)).toHaveLength(1);
  });

  it('fails when git fails', () => {
    expect(() => reasons('base', 'head', mutate, fakeGit({}))).toThrow(
      'git diff --name-only -z --no-renames base head',
    );
  });
});

describe('mutation changes: the command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const output = () => ({
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  });

  it('prints true and the reasons when the jobs run', () => {
    const { log, error } = output();
    const git = fakeGit({ [diff]: 'src/core/economy.ts\0vitest.config.ts\0' });
    expect(main(['base', 'head'], git)).toBe(0);
    expect(log.mock.calls).toEqual([['true']]);
    expect(error.mock.calls).toEqual([
      [
        'Mutation jobs run: src/core/economy.ts is mutated (stryker.config.json)',
      ],
      ['Mutation jobs run: vitest.config.ts configures the mutation run'],
    ]);
  });

  it('prints false when nothing of the mutation run changed', () => {
    const { log, error } = output();
    const git = fakeGit({
      'diff --name-only -z --no-renames base HEAD': 'Dockerfile\0',
    });
    expect(main(['base'], git)).toBe(0);
    expect(log.mock.calls).toEqual([['false']]);
    expect(error.mock.calls).toEqual([
      [
        'No mutated file, test file, mutation configuration or test tool chain changed: the mutation jobs are skipped.',
      ],
    ]);
  });

  it('needs the commit to compare with', () => {
    const { log, error } = output();
    expect(main([], fakeGit({}))).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(error.mock.calls).toEqual([
      ['Usage: mutation-changes.ts <from> [<to>]'],
    ]);
  });
});
