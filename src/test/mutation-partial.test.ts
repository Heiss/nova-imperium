import { existsSync, globSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filesOf,
  floorChanges,
  main,
  partialConfig,
  partialSet,
  plan,
  sources,
} from '../../scripts/mutation-partial.ts';
import { isMutated } from '../../scripts/mutation-changes.ts';
import { type StrykerConfig } from '../../scripts/mutation-shards.ts';

const stryker = JSON.parse(
  readFileSync('stryker.config.json', 'utf8'),
) as StrykerConfig;
const mutate = stryker.mutate;

/** A tree that has exactly these files. */
const has =
  (...files: string[]) =>
  (file: string): boolean =>
    files.includes(file);

/** A git with fixed answers; a command it does not know fails. */
const fakeGit =
  (answers: Record<string, string>) =>
  (args: string[]): string => {
    const answer = answers[args.join(' ')];
    if (answer === undefined) throw new Error(`git ${args.join(' ')}`);
    return answer;
  };
const diff = 'diff --name-only -z --no-renames base head';

const lockfile = (vitest: string): string =>
  [
    "lockfileVersion: '9.0'",
    '',
    'packages:',
    '',
    `  vitest@${vitest}:`,
    '    resolution: {integrity: sha512-x}',
    '',
    "  '@stryker-mutator/core@10.1.1':",
    '    resolution: {integrity: sha512-x}',
    '',
    '  typescript@6.0.3:',
    '    resolution: {integrity: sha512-x}',
    '',
  ].join('\n');

describe('partial mutation run: the source of a test file', () => {
  it('is the file of the same name, without ".test"', () => {
    expect(sources('src/core/economy.test.ts')).toContain(
      'src/core/economy.ts',
    );
    expect(sources('src/core/economy.test.ts')).not.toContain(
      'src/server/economy.ts',
    );
  });

  it('leaves out every dotted suffix of the name, one at a time', () => {
    expect(sources('src/server/db/migrations.property.test.ts')).toEqual([
      'src/server/db/migrations.property.ts',
      'src/server/db/migrations.property.svelte.ts',
      'src/server/db/migrations.ts',
      'src/server/db/migrations.svelte.ts',
    ]);
    const deep = sources('src/a/x.y.z.test.ts');
    expect(deep).toContain('src/a/x.y.ts');
    expect(deep).toContain('src/a/x.ts');
  });

  it('keeps the dots of the folders and does not read a hidden name as empty', () => {
    expect(sources('src/a.b/x.test.ts')).toEqual([
      'src/a.b/x.ts',
      'src/a.b/x.svelte.ts',
    ]);
    expect(sources('src/a/.hidden.test.ts')).toEqual([
      'src/a/.hidden.ts',
      'src/a/.hidden.svelte.ts',
    ]);
  });

  it('may end in .svelte.ts (state.test.ts tests state.svelte.ts)', () => {
    expect(sources('src/client/logic/state.test.ts')).toContain(
      'src/client/logic/state.svelte.ts',
    );
    expect(sources('src/client/logic/state.svelte.test.ts')).toContain(
      'src/client/logic/state.svelte.ts',
    );
  });

  it('is, for a test in src/test/, also the script of the same name', () => {
    expect(sources('src/test/size-ratchet.test.ts')).toEqual([
      'src/test/size-ratchet.ts',
      'src/test/size-ratchet.svelte.ts',
      'scripts/size-ratchet.ts',
      'scripts/size-ratchet.svelte.ts',
    ]);
    expect(sources('src/core/size-ratchet.test.ts')).not.toContain(
      'scripts/size-ratchet.ts',
    );
    expect(sources('src/test/deep/x.test.ts')).not.toContain('scripts/x.ts');
  });

  it('is none for a file that is no test', () => {
    for (const file of [
      'src/core/economy.ts',
      'src/test/fixtures.ts',
      'src/server/test-helpers.ts',
      'src/core/economy.test.tsx',
      'src/core/economy.test.ts.bak',
      'src/test/legacy/game.cjs',
    ])
      expect(sources(file)).toEqual([]);
  });
});

describe('partial mutation run: the set of files', () => {
  const tree = has(
    'src/core/economy.ts',
    'src/core/fleet.ts',
    'src/client/logic/state.svelte.ts',
    'src/client/views/galaxy.ts',
    'scripts/size-ratchet.ts',
    'src/server/main.ts',
  );

  it('holds a changed mutated file', () => {
    expect(partialSet(['src/core/economy.ts'], mutate, tree)).toEqual([
      'src/core/economy.ts',
    ]);
  });

  it('holds the source of a changed test file, not the test file', () => {
    expect(partialSet(['src/core/economy.test.ts'], mutate, tree)).toEqual([
      'src/core/economy.ts',
    ]);
    expect(
      partialSet(['src/client/logic/state.test.ts'], mutate, tree),
    ).toEqual(['src/client/logic/state.svelte.ts']);
    expect(partialSet(['src/test/size-ratchet.test.ts'], mutate, tree)).toEqual(
      ['scripts/size-ratchet.ts'],
    );
  });

  it('lists a file once, sorted', () => {
    expect(
      partialSet(
        [
          'src/core/fleet.ts',
          'src/core/economy.test.ts',
          'src/core/economy.ts',
          'src/core/fleet.test.ts',
        ],
        mutate,
        tree,
      ),
    ).toEqual(['src/core/economy.ts', 'src/core/fleet.ts']);
  });

  it('leaves out a deleted file and the source of a test that is not there', () => {
    expect(partialSet(['src/core/gone.ts'], mutate, tree)).toEqual([]);
    expect(partialSet(['src/core/gone.test.ts'], mutate, tree)).toEqual([]);
    expect(partialSet(['src/core/economy.test.ts'], mutate, has())).toEqual([]);
  });

  it('leaves out what Stryker does not mutate', () => {
    expect(partialSet(['src/server/main.ts'], mutate, tree)).toEqual([]);
    expect(
      partialSet(['src/client/views/galaxy.test.ts'], mutate, tree),
    ).toEqual([]);
    expect(partialSet(['src/client/views/galaxy.ts'], mutate, tree)).toEqual(
      [],
    );
  });

  it('is empty for documentation, a helper and a test without a source', () => {
    expect(
      partialSet(
        [
          'okf/ops/testing.md',
          'src/test/fixtures.ts',
          'src/server/test-helpers.ts',
          'src/test/okf-log.test.ts',
          'e2e/game.spec.ts',
        ],
        mutate,
        tree,
      ),
    ).toEqual([]);
    expect(partialSet([], mutate, tree)).toEqual([]);
  });

  it('finds the source of every test file the repository has by name', () => {
    let found = 0;
    for (const test of globSync('src/**/*.test.ts').map((f) =>
      f.split('\\').join('/'),
    )) {
      const own = test.replace(/\.test\.ts$/, '.ts');
      const set = partialSet([test], mutate, existsSync);
      if (existsSync(own) && isMutated(own, mutate)) {
        expect(set).toContain(own);
        found++;
      }
      for (const file of set) {
        expect(existsSync(file)).toBe(true);
        expect(isMutated(file, mutate)).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(100);
  });
});

describe('partial mutation run: the plan', () => {
  const lock = lockfile('5.1.0');

  it('is the files of the changes', () => {
    const git = fakeGit({
      [diff]: 'okf/log/x.md\0src/core/economy.ts\0src/core/fleet.test.ts\0',
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git,
        has('src/core/economy.ts', 'src/core/fleet.ts'),
      ),
    ).toEqual({
      reasons: [],
      files: ['src/core/economy.ts', 'src/core/fleet.ts'],
    });
  });

  it('is empty when nothing it tests changed', () => {
    const git = fakeGit({ [diff]: 'README.md\0Dockerfile\0package.json\0' });
    expect(plan('base', 'head', mutate, git, has())).toEqual({
      reasons: [],
      files: [],
    });
  });

  it('runs everything when the mutation configuration changed', () => {
    for (const file of [
      'stryker.config.json',
      'vitest.config.ts',
      'tsconfig.json',
      'scripts/mutation-gate.ts',
      'scripts/mutation-partial.ts',
    ]) {
      const git = fakeGit({ [diff]: `src/core/economy.ts\0${file}\0` });
      expect(
        plan('base', 'head', mutate, git, has('src/core/economy.ts')),
      ).toEqual({
        reasons: [`${file} configures the mutation run`],
        files: [],
      });
    }
  });

  it('runs everything when the test tool chain changed', () => {
    const git = fakeGit({
      [diff]: 'pnpm-lock.yaml\0src/core/economy.ts\0',
      'show base:pnpm-lock.yaml': lock,
      'show head:pnpm-lock.yaml': lockfile('5.2.0'),
    });
    expect(
      plan('base', 'head', mutate, git, has('src/core/economy.ts')),
    ).toEqual({
      reasons: [
        'pnpm-lock.yaml changes the test tool chain: -vitest@5.1.0 +vitest@5.2.0',
      ],
      files: [],
    });
  });

  it('does not run everything for other dependencies', () => {
    const git = fakeGit({
      [diff]: 'pnpm-lock.yaml\0',
      'show base:pnpm-lock.yaml': lock,
      'show head:pnpm-lock.yaml': `${lock}\n  left-pad@1.0.0:\n    resolution: {}\n`,
    });
    expect(plan('base', 'head', mutate, git, has())).toEqual({
      reasons: [],
      files: [],
    });
  });

  it('lists every reason', () => {
    const git = fakeGit({
      [diff]: 'pnpm-lock.yaml\0vitest.config.ts\0stryker.config.json\0',
      'show base:pnpm-lock.yaml': lock,
      'show head:pnpm-lock.yaml': lockfile('5.2.0'),
    });
    expect(plan('base', 'head', mutate, git, has()).reasons).toEqual([
      'vitest.config.ts configures the mutation run',
      'stryker.config.json configures the mutation run',
      'pnpm-lock.yaml changes the test tool chain: -vitest@5.1.0 +vitest@5.2.0',
    ]);
  });

  it('fails when git fails', () => {
    expect(() => plan('base', 'head', mutate, fakeGit({}), has())).toThrow(
      'git diff --name-only -z --no-renames base head',
    );
  });
});

/** The text of a mutation-standard.json with these floors. */
const standardOf = (
  floors: Record<string, unknown>,
  rest: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    securityTarget: 90,
    newFile: 80,
    security: ['src/server/auth.ts'],
    floors,
    ...rest,
  });

describe('partial mutation run: the floors of mutation-standard.json', () => {
  const before = standardOf({
    'src/core/a.ts': 70,
    'src/core/b.ts': 80,
    'src/core/gone.ts': 90,
  });

  it('is every file whose floor was added, raised, lowered or removed', () => {
    const after = standardOf({
      'src/core/a.ts': 75.5,
      'src/core/b.ts': 80,
      'src/core/new.ts': 85,
    });
    expect(floorChanges(before, after)).toEqual({
      files: ['src/core/a.ts', 'src/core/gone.ts', 'src/core/new.ts'],
    });
    const lowered = standardOf({
      'src/core/a.ts': 60,
      'src/core/b.ts': 80,
      'src/core/gone.ts': 90,
    });
    expect(floorChanges(before, lowered)).toEqual({
      files: ['src/core/a.ts'],
    });
  });

  it('is no file when the floors are the same, however they are written', () => {
    const spaced = JSON.stringify(JSON.parse(before), null, 4);
    expect(floorChanges(before, spaced)).toEqual({ files: [] });
    const reordered = standardOf({
      'src/core/gone.ts': 90,
      'src/core/b.ts': 80,
      'src/core/a.ts': 70,
    });
    expect(floorChanges(before, reordered)).toEqual({ files: [] });
  });

  it('lists the files sorted', () => {
    expect(
      floorChanges(
        standardOf({}),
        standardOf({ 'z.ts': 1, 'a.ts': 1, 'm.ts': 1 }),
      ),
    ).toEqual({ files: ['a.ts', 'm.ts', 'z.ts'] });
  });

  it('runs everything when another key changed', () => {
    const more = 'changes more than the floors';
    for (const [rest, keys] of [
      [{ newFile: 70 }, 'newFile'],
      [{ securityTarget: 95 }, 'securityTarget'],
      [{ security: ['src/server/auth.ts', 'src/server/audit.ts'] }, 'security'],
      [{ security: [] }, 'security'],
      [{ newFile: 70, securityTarget: 95 }, 'newFile, securityTarget'],
    ] as const) {
      const after = standardOf(JSON.parse(before).floors, rest);
      expect(floorChanges(before, after)).toEqual({
        reason: `mutation-standard.json ${more}: ${keys}`,
      });
    }
    // The order of the security files counts as a change.
    const swapped = (a: string[]) => standardOf({}, { security: a });
    expect(floorChanges(swapped(['a', 'b']), swapped(['b', 'a']))).toEqual({
      reason: `mutation-standard.json ${more}: security`,
    });
  });

  it('runs everything when the file is of a form the script does not know', () => {
    const unknown = {
      reason: 'mutation-standard.json is not of the form this script knows',
    };
    const extra = standardOf({}, { total: 80 });
    const missing = JSON.stringify({ securityTarget: 90, newFile: 80 });
    const noFloors = JSON.stringify({
      securityTarget: 90,
      newFile: 80,
      security: [],
      floors: [],
    });
    const nullFloors = standardOf(null as never);
    const text = standardOf({ 'src/core/a.ts': '70' });
    for (const bad of [
      extra,
      missing,
      noFloors,
      nullFloors,
      text,
      '[]',
      'null',
      '7',
      '{',
      '',
      undefined,
    ]) {
      expect(floorChanges(before, bad)).toEqual(unknown);
      expect(floorChanges(bad, before)).toEqual(unknown);
    }
    expect(floorChanges(undefined, undefined)).toEqual(unknown);
  });
});

describe('partial mutation run: the plan with a change of the floors', () => {
  const standard = (floors: Record<string, unknown>, rest = {}): string =>
    standardOf(floors, rest);
  const old = standard({ 'src/core/economy.ts': 70, 'src/core/fleet.ts': 80 });
  const git =
    (files: string[], after: string, before: string | null = old) =>
    (args: string[]): string => {
      const call = args.join(' ');
      if (call === diff) return `${files.join('\0')}\0`;
      if (call === 'show base:mutation-standard.json') {
        if (before === null) throw new Error(call);
        return before;
      }
      if (call === 'show head:mutation-standard.json') return after;
      throw new Error(`git ${call}`);
    };
  const tree = has(
    'src/core/economy.ts',
    'src/core/fleet.ts',
    'src/core/moon.ts',
    'src/server/main.ts',
  );

  it('proves a floor added for a changed source file in the run of that file', () => {
    const after = standard({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 80,
      'src/core/moon.ts': 85,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json', 'src/core/moon.ts'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: ['src/core/moon.ts'] });
  });

  it('adds a file whose floor was raised, though the pull request does not touch it', () => {
    const after = standard({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 90,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json', 'src/core/economy.ts'], after),
        tree,
      ),
    ).toEqual({
      reasons: [],
      files: ['src/core/economy.ts', 'src/core/fleet.ts'],
    });
  });

  it('adds a file whose floor was removed (checked against the new-file minimum)', () => {
    const after = standard({ 'src/core/economy.ts': 70 });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: ['src/core/fleet.ts'] });
  });

  it('adds a file whose floor was lowered; nothing refuses it here', () => {
    const after = standard({
      'src/core/economy.ts': 50,
      'src/core/fleet.ts': 80,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: ['src/core/economy.ts'] });
  });

  it('leaves out a file of the floors that is not mutated or not there any more', () => {
    const after = standard({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 80,
      'src/core/deleted.ts': 90,
      'src/server/main.ts': 90,
      'src/client/views/galaxy.ts': 90,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: [] });
  });

  it('is empty when only the formatting of the floors changed', () => {
    const after = JSON.stringify(JSON.parse(old), null, 2);
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: [] });
  });

  it('runs everything when more than the floors changed', () => {
    const after = standard(
      { 'src/core/economy.ts': 70, 'src/core/fleet.ts': 80 },
      { newFile: 70 },
    );
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json', 'src/core/moon.ts'], after),
        tree,
      ),
    ).toEqual({
      reasons: ['mutation-standard.json changes more than the floors: newFile'],
      files: [],
    });
  });

  it('runs everything when the file cannot be read on either side', () => {
    const unknown =
      'mutation-standard.json is not of the form this script knows';
    const files = ['mutation-standard.json', 'src/core/moon.ts'];
    expect(plan('base', 'head', mutate, git(files, old, null), tree)).toEqual({
      reasons: [unknown],
      files: [],
    });
    expect(
      plan('base', 'head', mutate, git(files, '{ not json'), tree),
    ).toEqual({
      reasons: [unknown],
      files: [],
    });
    expect(
      plan('base', 'head', mutate, git(files, old, '{ not json'), tree),
    ).toEqual({
      reasons: [unknown],
      files: [],
    });
  });

  it('runs everything when a floor and another configuration file changed', () => {
    const after = standard({
      'src/core/economy.ts': 75,
      'src/core/fleet.ts': 80,
    });
    for (const other of [
      'stryker.config.json',
      'vitest.config.ts',
      'tsconfig.json',
      'scripts/mutation-gate.ts',
    ])
      expect(
        plan(
          'base',
          'head',
          mutate,
          git(['mutation-standard.json', other], after),
          tree,
        ),
      ).toEqual({
        reasons: [`${other} configures the mutation run`],
        files: [],
      });
  });

  it('lists the reasons of the configuration and of the floors together', () => {
    const after = standard({}, { newFile: 70 });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['stryker.config.json', 'mutation-standard.json'], after),
        tree,
      ).reasons,
    ).toEqual([
      'stryker.config.json configures the mutation run',
      'mutation-standard.json changes more than the floors: newFile',
    ]);
  });

  it('runs everything when the lockfile changes the tool chain, whatever the floors', () => {
    const lockGit = (args: string[]): string => {
      const call = args.join(' ');
      if (call === diff) return 'mutation-standard.json\0pnpm-lock.yaml\0';
      if (call === 'show base:pnpm-lock.yaml') return lockfile('5.1.0');
      if (call === 'show head:pnpm-lock.yaml') return lockfile('5.2.0');
      return git([], old)(args);
    };
    expect(plan('base', 'head', mutate, lockGit, tree).reasons).toEqual([
      'pnpm-lock.yaml changes the test tool chain: -vitest@5.1.0 +vitest@5.2.0',
    ]);
  });
});

describe('partial mutation run: the files of a run', () => {
  it('reads the JSON list', () => {
    expect(filesOf('["src/a.ts","src/b.ts"]')).toEqual([
      'src/a.ts',
      'src/b.ts',
    ]);
  });

  it('fails without a list of files', () => {
    for (const value of [
      undefined,
      '',
      'src/a.ts',
      '[]',
      '{"a":"src/a.ts"}',
      '"src/a.ts"',
      '[1]',
      '[""]',
      '["src/a.ts",null]',
    ])
      expect(() => filesOf(value)).toThrow(
        'MUTATION_FILES is no JSON list of files.',
      );
  });

  it('is the configuration without the break threshold and the incremental file', () => {
    const config = partialConfig({ ...stryker, $schema: './schema.json' }, [
      'src/a.ts',
      'src/b.ts',
    ]);
    expect(config).not.toHaveProperty('$schema');
    const rest = { ...stryker };
    delete rest.$schema;
    expect(config).toEqual({
      ...rest,
      mutate: ['src/a.ts', 'src/b.ts'],
      incremental: false,
      thresholds: { ...stryker.thresholds, break: null },
    });
  });
});

describe('partial mutation run: the command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  const output = () => ({
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  });
  const read = (file: string): string => {
    if (file !== 'stryker.config.json') throw new Error(file);
    return JSON.stringify(stryker);
  };

  it('prints the list of files and says which', () => {
    const { log, error } = output();
    const git = fakeGit({ [diff]: 'src/core/economy.ts\0' });
    const deps = { git, read, exists: has('src/core/economy.ts') };
    expect(main(['plan', 'base', 'head'], deps)).toBe(0);
    expect(log.mock.calls).toEqual([['["src/core/economy.ts"]']]);
    expect(error.mock.calls).toEqual([
      ['Mutation run for the changed files: src/core/economy.ts'],
    ]);
  });

  it('compares with HEAD by default', () => {
    const { log } = output();
    const git = fakeGit({
      'diff --name-only -z --no-renames base HEAD': 'src/core/fleet.ts\0',
    });
    expect(
      main(['plan', 'base'], { git, read, exists: has('src/core/fleet.ts') }),
    ).toBe(0);
    expect(log.mock.calls).toEqual([['["src/core/fleet.ts"]']]);
  });

  it('prints [] and says that the jobs are skipped', () => {
    const { log, error } = output();
    const git = fakeGit({ [diff]: 'README.md\0' });
    expect(main(['plan', 'base', 'head'], { git, read, exists: has() })).toBe(
      0,
    );
    expect(log.mock.calls).toEqual([['[]']]);
    expect(error.mock.calls).toEqual([
      [
        'No mutated file, source of a changed test file, mutation configuration or test tool chain changed: the mutation jobs are skipped.',
      ],
    ]);
  });

  it('prints true and the reasons when everything runs', () => {
    const { log, error } = output();
    const git = fakeGit({
      [diff]: 'src/core/economy.ts\0stryker.config.json\0',
    });
    expect(
      main(['plan', 'base', 'head'], {
        git,
        read,
        exists: has('src/core/economy.ts'),
      }),
    ).toBe(0);
    expect(log.mock.calls).toEqual([['true']]);
    expect(error.mock.calls).toEqual([
      [
        'Complete mutation run: stryker.config.json configures the mutation run',
      ],
    ]);
  });

  it('needs the commit to compare with', () => {
    const { log, error } = output();
    expect(main(['plan'], { git: fakeGit({}), read })).toBe(1);
    expect(log).not.toHaveBeenCalled();
    expect(error.mock.calls).toEqual([
      ['Usage: mutation-partial.ts plan <from> [<to>]'],
    ]);
  });

  it('writes the configuration of the files in MUTATION_FILES', () => {
    const { log } = output();
    const written: [string, string][] = [];
    const write = (file: string, text: string): void => {
      written.push([file, text]);
    };
    expect(
      main(['config'], { read, write, files: '["src/a.ts","src/b.ts"]' }),
    ).toBe(0);
    expect(written).toHaveLength(1);
    expect(written[0]![0]).toBe('reports/stryker-partial.config.json');
    expect(written[0]![1].endsWith('}\n')).toBe(true);
    expect(JSON.parse(written[0]![1])).toEqual(
      partialConfig(stryker, ['src/a.ts', 'src/b.ts']),
    );
    expect(log.mock.calls).toEqual([
      [
        '2 files in reports/stryker-partial.config.json:\n  src/a.ts\n  src/b.ts',
      ],
    ]);
  });

  it('writes nothing without files', () => {
    const write = vi.fn();
    expect(() => main(['config'], { read, write, files: undefined })).toThrow(
      'MUTATION_FILES is no JSON list of files.',
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('reads MUTATION_FILES of the environment by default', () => {
    vi.stubEnv('MUTATION_FILES', '["src/c.ts"]');
    output();
    const write = vi.fn();
    expect(main(['config'], { read, write })).toBe(0);
    expect(JSON.parse(write.mock.calls[0]![1] as string).mutate).toEqual([
      'src/c.ts',
    ]);
    vi.unstubAllEnvs();
  });

  it('names its commands', () => {
    const { error } = output();
    expect(main([], {})).toBe(1);
    expect(main(['merge'], {})).toBe(1);
    expect(error.mock.calls).toEqual([
      ['Usage: mutation-partial.ts plan <from> [<to>] | config'],
      ['Usage: mutation-partial.ts plan <from> [<to>] | config'],
    ]);
  });
});

describe('partial mutation run: the job in ci.yml', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const job = (name: string): string => {
    const start = ci.indexOf(`\n  ${name}:\n`);
    expect(start).toBeGreaterThan(0);
    const next = /\n {2}[a-z][a-z-]*:\n/.exec(ci.slice(start + 1));
    return ci.slice(start, next ? start + 1 + next.index : undefined);
  };
  // The cache keys and artifacts of the complete runs and their plans.
  const complete = [
    'actions/cache',
    'stryker-shard',
    'stryker-state',
    'stryker-report',
    'stryker-weights',
    'mutation-state',
    'mutation-shard-',
    'stryker-incremental',
    'mutation-shards.ts',
  ];

  it('reads and writes no cache and no plan of the complete runs', () => {
    const partial = job('mutation-partial');
    expect(partial).toContain('Mutation tests (changed files)');
    for (const word of complete) expect(partial).not.toContain(word);
  });

  it('runs only for the output "partial" and only after "Detect changes"', () => {
    const partial = job('mutation-partial');
    expect(partial).toContain('needs: changes\n');
    expect(partial).toContain(
      "if: needs.changes.outputs.mutation == 'partial'\n",
    );
    expect(partial).toContain(
      'MUTATION_FILES: ${{ needs.changes.outputs.mutation-files }}',
    );
    for (const name of ['mutation-plan', 'mutation-shard', 'mutation'])
      expect(job(name)).toContain(
        "if: needs.changes.outputs.mutation == 'true'",
      );
  });

  it('keeps the complete runs on their caches (the jobs of the shards and the nightly run)', () => {
    const nightly = readFileSync('.github/workflows/mutation.yml', 'utf8');
    for (const text of [
      job('mutation-plan'),
      job('mutation-shard'),
      job('mutation'),
    ])
      expect(text).toContain('actions/cache');
    expect(nightly).toContain('stryker-weights-');
  });

  it('is a step of the gate job as well', () => {
    expect(job('gate')).toContain('        mutation-partial,\n');
    expect(job('gate')).toContain(
      'MUTATION_PARTIAL: ${{ needs.mutation-partial.result }}',
    );
  });
});
