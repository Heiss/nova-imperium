import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  filesOf,
  floorChanges,
  main,
  mergeParts,
  PART_FILES,
  partCount,
  partialConfig,
  partialSet,
  partPlanOf,
  partsOf,
  plan,
  reportsIn,
  sources,
} from '../../scripts/mutation-partial.ts';
import { isMutated } from '../../scripts/mutation-changes.ts';
import { formatFloors } from '../../scripts/mutation-floorfile.ts';
import {
  type Report,
  SHARDS,
  type StrykerConfig,
} from '../../scripts/mutation-shards.ts';

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

/** The text of a mutation-floors.txt with these floors. */
const floorsOf = (floors: Record<string, number>): string =>
  formatFloors(floors);

describe('partial mutation run: the floors of mutation-floors.txt', () => {
  const before = floorsOf({
    'src/core/a.ts': 70,
    'src/core/b.ts': 80,
    'src/core/gone.ts': 90,
  });

  it('is every file whose floor was added, raised, lowered or removed', () => {
    const after = floorsOf({
      'src/core/a.ts': 75.5,
      'src/core/b.ts': 80,
      'src/core/new.ts': 85,
    });
    expect(floorChanges(before, after)).toEqual({
      files: ['src/core/a.ts', 'src/core/gone.ts', 'src/core/new.ts'],
    });
    const lowered = floorsOf({
      'src/core/a.ts': 60,
      'src/core/b.ts': 80,
      'src/core/gone.ts': 90,
    });
    expect(floorChanges(before, lowered)).toEqual({
      files: ['src/core/a.ts'],
    });
  });

  it('is no file when the floors are the same, however the lines are ordered', () => {
    const reordered =
      'src/core/gone.ts 90\nsrc/core/b.ts 80\nsrc/core/a.ts 70\n';
    expect(floorChanges(before, reordered)).toEqual({ files: [] });
    expect(floorChanges(before, before.trimEnd())).toEqual({ files: [] });
    expect(floorChanges('', '')).toEqual({ files: [] });
  });

  it('lists the files sorted', () => {
    expect(floorChanges('', 'z.ts 1\na.ts 1\nm.ts 1\n')).toEqual({
      files: ['a.ts', 'm.ts', 'z.ts'],
    });
  });

  it('is the one file of two branches that each added another: git merges the lines', () => {
    // Different lines, no conflict: the merged file lists both new files.
    const merged = floorsOf({
      'src/core/a.ts': 70,
      'src/core/b.ts': 80,
      'src/core/gone.ts': 90,
      'src/core/x.ts': 81,
      'src/core/y.ts': 82,
    });
    expect(floorChanges(before, merged)).toEqual({
      files: ['src/core/x.ts', 'src/core/y.ts'],
    });
  });

  it('runs everything when the file is of a form the script does not know', () => {
    const form = 'mutation-floors.txt is not of the form this script knows: ';
    expect(floorChanges(undefined, before)).toEqual({
      reason: `${form}mutation-floors.txt is not there on both sides`,
    });
    expect(floorChanges(before, undefined)).toEqual({
      reason: `${form}mutation-floors.txt is not there on both sides`,
    });
    expect(floorChanges(before, 'src/core/a.ts\n')).toEqual({
      reason: `${form}mutation-floors.txt, line 1: "src/core/a.ts" is not "<file> <floor>".`,
    });
    expect(floorChanges('{"floors":{}}', before)).toEqual({
      reason: `${form}mutation-floors.txt, line 1: "{"floors":{}}" is not "<file> <floor>".`,
    });
    // Two lines for a file: no answer, so the complete run (and the gate) decide.
    const twice = floorChanges(before, `${before}src/core/a.ts 71\n`);
    expect(twice).toEqual({
      reason: expect.stringContaining(
        'src/core/a.ts has two floors (70 and 71)',
      ),
    });
  });
});

describe('partial mutation run: the plan with a change of the floors', () => {
  const old = floorsOf({ 'src/core/economy.ts': 70, 'src/core/fleet.ts': 80 });
  const git =
    (files: string[], after: string, before: string | null = old) =>
    (args: string[]): string => {
      const call = args.join(' ');
      if (call === diff) return `${files.join('\0')}\0`;
      if (call === 'show base:mutation-floors.txt') {
        if (before === null) throw new Error(call);
        return before;
      }
      if (call === 'show head:mutation-floors.txt') return after;
      throw new Error(`git ${call}`);
    };
  const tree = has(
    'src/core/economy.ts',
    'src/core/fleet.ts',
    'src/core/moon.ts',
    'src/server/main.ts',
  );
  const FLOORS = 'mutation-floors.txt';

  it('proves a floor added for a changed source file in the run of that file', () => {
    const after = floorsOf({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 80,
      'src/core/moon.ts': 85,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git([FLOORS, 'src/core/moon.ts'], after),
        tree,
      ),
    ).toEqual({ reasons: [], files: ['src/core/moon.ts'] });
  });

  it('adds a file whose floor was raised, though the pull request does not touch it', () => {
    const after = floorsOf({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 90,
    });
    expect(
      plan(
        'base',
        'head',
        mutate,
        git([FLOORS, 'src/core/economy.ts'], after),
        tree,
      ),
    ).toEqual({
      reasons: [],
      files: ['src/core/economy.ts', 'src/core/fleet.ts'],
    });
  });

  it('adds a file whose floor was removed (checked against the new-file minimum)', () => {
    const after = floorsOf({ 'src/core/economy.ts': 70 });
    expect(plan('base', 'head', mutate, git([FLOORS], after), tree)).toEqual({
      reasons: [],
      files: ['src/core/fleet.ts'],
    });
  });

  it('adds a file whose floor was lowered; nothing refuses it here', () => {
    const after = floorsOf({
      'src/core/economy.ts': 50,
      'src/core/fleet.ts': 80,
    });
    expect(plan('base', 'head', mutate, git([FLOORS], after), tree)).toEqual({
      reasons: [],
      files: ['src/core/economy.ts'],
    });
  });

  it('leaves out a file of the floors that is not mutated or not there any more', () => {
    const after = floorsOf({
      'src/core/economy.ts': 70,
      'src/core/fleet.ts': 80,
      'src/core/deleted.ts': 90,
      'src/server/main.ts': 90,
      'src/client/views/galaxy.ts': 90,
    });
    expect(plan('base', 'head', mutate, git([FLOORS], after), tree)).toEqual({
      reasons: [],
      files: [],
    });
  });

  it('is empty when only the order of the lines changed', () => {
    const after = 'src/core/fleet.ts 80\nsrc/core/economy.ts 70\n';
    expect(plan('base', 'head', mutate, git([FLOORS], after), tree)).toEqual({
      reasons: [],
      files: [],
    });
  });

  it('runs everything when mutation-standard.json changes, whatever it changes', () => {
    // newFile, security and securityTarget are no floors: the complete run.
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['mutation-standard.json', 'src/core/moon.ts'], old),
        tree,
      ),
    ).toEqual({
      reasons: ['mutation-standard.json configures the mutation run'],
      files: [],
    });
  });

  it('runs everything for the change that introduces the file, once', () => {
    // The base has no mutation-floors.txt (the floors were in
    // mutation-standard.json): the format change runs everything once.
    const form = 'mutation-floors.txt is not of the form this script knows: ';
    expect(
      plan(
        'base',
        'head',
        mutate,
        git([FLOORS, 'mutation-standard.json'], old, null),
        tree,
      ).reasons,
    ).toEqual([
      'mutation-standard.json configures the mutation run',
      `${form}mutation-floors.txt is not there on both sides`,
    ]);
    // The next change has the file on both sides: a partial run again.
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(
          [FLOORS],
          floorsOf({ 'src/core/economy.ts': 71, 'src/core/fleet.ts': 80 }),
        ),
        tree,
      ),
    ).toEqual({ reasons: [], files: ['src/core/economy.ts'] });
  });

  it('runs everything when the file has a line of another form on either side', () => {
    const form = 'mutation-floors.txt is not of the form this script knows: ';
    const bad = 'src/core/economy.ts 70\nnot a floor\n';
    const line = `${form}mutation-floors.txt, line 2: "not a floor" is not "<file> <floor>".`;
    expect(plan('base', 'head', mutate, git([FLOORS], bad), tree)).toEqual({
      reasons: [line],
      files: [],
    });
    expect(plan('base', 'head', mutate, git([FLOORS], old, bad), tree)).toEqual(
      { reasons: [line], files: [] },
    );
  });

  it('runs everything when a floor and another configuration file changed', () => {
    const after = floorsOf({
      'src/core/economy.ts': 75,
      'src/core/fleet.ts': 80,
    });
    for (const other of [
      'stryker.config.json',
      'vitest.config.ts',
      'tsconfig.json',
      'scripts/mutation-gate.ts',
      'scripts/mutation-floors.ts',
    ])
      expect(
        plan('base', 'head', mutate, git([FLOORS, other], after), tree),
      ).toEqual({
        reasons: [`${other} configures the mutation run`],
        files: [],
      });
  });

  it('lists the reasons of the configuration and of the floors together', () => {
    expect(
      plan(
        'base',
        'head',
        mutate,
        git(['stryker.config.json', FLOORS], 'not a floor\n'),
        tree,
      ).reasons,
    ).toEqual([
      'stryker.config.json configures the mutation run',
      'mutation-floors.txt is not of the form this script knows: mutation-floors.txt, line 1: "not a floor" is not "<file> <floor>".',
    ]);
  });

  it('runs everything when the lockfile changes the tool chain, whatever the floors', () => {
    const lockGit = (args: string[]): string => {
      const call = args.join(' ');
      if (call === diff) return 'mutation-floors.txt\0pnpm-lock.yaml\0';
      if (call === 'show base:pnpm-lock.yaml') return lockfile('5.1.0');
      if (call === 'show head:pnpm-lock.yaml') return lockfile('5.2.0');
      return git([], old)(args);
    };
    expect(plan('base', 'head', mutate, lockGit, tree).reasons).toEqual([
      'pnpm-lock.yaml changes the test tool chain: -vitest@5.1.0 +vitest@5.2.0',
    ]);
  });
});

describe('partial mutation run: no limit of the size (#370, 189a)', () => {
  /** n mutated files a0.ts, a1.ts ... of src/core. */
  const names = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `src/core/a${i}.ts`);
  const diffOf = (files: string[]) =>
    fakeGit({ [diff]: `${files.join('\0')}\0` });

  it('runs a set of any size as a partial run', () => {
    for (const n of [1, 12, 13, 33, 200]) {
      const files = names(n);
      expect(
        plan('base', 'head', mutate, diffOf(files), has(...files)),
      ).toEqual({ reasons: [], files: [...files].sort() });
    }
  });

  it('runs everything only for the mutation configuration, not for the size', () => {
    const files = names(40);
    expect(
      plan(
        'base',
        'head',
        mutate,
        diffOf([...files, 'stryker.config.json']),
        has(...files),
      ),
    ).toEqual({
      reasons: ['stryker.config.json configures the mutation run'],
      files: [],
    });
  });
});

describe('partial mutation run: the parts (#370, 190a)', () => {
  const names = (n: number): string[] =>
    Array.from(
      { length: n },
      (_, i) => `src/core/a${String(i).padStart(3, '0')}.ts`,
    );
  /** A report whose file <f> has mutants of <ms> milliseconds each. */
  const reportOf = (files: Record<string, number[]>): Report => ({
    files: Object.fromEntries(
      Object.entries(files).map(([f, ms]) => [
        f,
        { mutants: ms.map((duration) => ({ duration })) },
      ]),
    ),
  });
  const lines = (): number => 10;

  it('is one part for each 12 files begun, at most the number of shards', () => {
    expect(PART_FILES).toBe(12);
    expect(SHARDS).toBe(12);
    expect(
      [1, 11, 12, 13, 24, 25, 36, 37, 144, 145, 1000].map(partCount),
    ).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 12, 12, 12]);
    expect(partCount(0)).toBe(1);
  });

  it('keeps a set of up to 12 files in one part', () => {
    const files = names(12);
    expect(partsOf(files, undefined, lines)).toEqual([files]);
  });

  it('puts every file into exactly one part, sorted in its part', () => {
    for (const n of [13, 30, 200]) {
      const files = names(n);
      const parts = partsOf(files, undefined, lines);
      expect(parts).toHaveLength(partCount(n));
      expect(parts.flat().sort()).toEqual(files);
      for (const part of parts) expect(part).toEqual([...part].sort());
    }
  });

  it('splits by the weights: a heavy file gets a part of its own', () => {
    const files = names(13);
    const heavy = files[5]!;
    const report = reportOf(
      Object.fromEntries(files.map((f) => [f, f === heavy ? [1000] : [1]])),
    );
    expect(partsOf(files, report, lines)).toEqual([
      [heavy],
      files.filter((f) => f !== heavy),
    ]);
  });

  it('weighs a file without a report by its lines', () => {
    const files = names(13);
    const big = files[0]!;
    const parts = partsOf(files, undefined, (f) => (f === big ? 500 : 1));
    expect(parts).toEqual([[big], files.slice(1)]);
  });

  it('leaves out an empty part', () => {
    // 13 files where the report knows one with weight and twelve without
    // mutants: the weightless files all go onto the lightest part.
    const files = names(13);
    const report = reportOf(
      Object.fromEntries(files.map((f, i) => [f, i === 0 ? [5] : []])),
    );
    const parts = partsOf(files, report, lines);
    expect(parts.every((p) => p.length > 0)).toBe(true);
    expect(parts.flat().sort()).toEqual(files);
  });

  it('gives the same plan for the same input', () => {
    const files = names(50);
    expect(partsOf([...files].reverse(), undefined, lines)).toEqual(
      partsOf(files, undefined, lines),
    );
  });
});

describe('partial mutation run: the plan of the parts in MUTATION_PLAN', () => {
  it('reads the JSON list of parts', () => {
    expect(partPlanOf('[["src/a.ts"],["src/b.ts","src/c.ts"]]')).toEqual([
      ['src/a.ts'],
      ['src/b.ts', 'src/c.ts'],
    ]);
  });

  it('fails without a list of parts of files', () => {
    for (const value of [
      undefined,
      '',
      'x',
      '[]',
      '[[]]',
      '["src/a.ts"]',
      '[["src/a.ts"],[]]',
      '[[1]]',
      '[[""]]',
      '{"a":["src/a.ts"]}',
    ])
      expect(() => partPlanOf(value)).toThrow(
        'MUTATION_PLAN is no JSON list of parts of files.',
      );
  });
});

describe('partial mutation run: the merge of the parts', () => {
  const thresholds = { high: 90, low: 80, break: 80 };
  const ran = (mutate: string[], files: Record<string, number>): Report => ({
    schemaVersion: '2',
    config: { mutate },
    testFiles: {},
    files: Object.fromEntries(
      Object.entries(files).map(([f, n]) => [
        f,
        {
          mutants: Array.from({ length: n }, (_, i) => ({
            mutatorName: 'm',
            replacement: String(i),
            location: {
              start: { line: i + 1, column: 1 },
              end: { line: i + 1, column: 2 },
            },
          })),
        },
      ]),
    ),
  });
  const plan2 = [['src/a.ts', 'src/b.ts'], ['src/c.ts']];

  it('merges the parts into one report that names every file of the plan', () => {
    const merged = mergeParts(
      plan2,
      [
        ran(['src/c.ts'], { 'src/c.ts': 2 }),
        ran(['src/b.ts', 'src/a.ts'], { 'src/a.ts': 1 }),
      ],
      thresholds,
    );
    expect(merged).not.toHaveProperty('problems');
    const report = (merged as { report: Report }).report;
    expect(report.config).toEqual({
      mutate: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    });
    expect(report.thresholds).toEqual(thresholds);
    expect(report).not.toHaveProperty('testFiles');
    expect(Object.keys(report.files).sort()).toEqual(['src/a.ts', 'src/c.ts']);
    expect(report.files['src/c.ts']!.mutants).toHaveLength(2);
  });

  it('fails when a part is missing, ran twice or ran other files', () => {
    const a = ran(['src/a.ts', 'src/b.ts'], { 'src/a.ts': 1 });
    const c = ran(['src/c.ts'], { 'src/c.ts': 1 });
    const problemsOf = (reports: Report[]): string[] => {
      const merged = mergeParts(plan2, reports, thresholds);
      return 'problems' in merged ? merged.problems : [];
    };
    expect(problemsOf([a])).toEqual(['shard 2 has 0 reports']);
    expect(problemsOf([a, c, c])).toContain('shard 2 has 2 reports');
    expect(problemsOf([a, ran(['src/c.ts', 'src/d.ts'], {})])).toContain(
      'report 2 ran files that are no shard of the plan',
    );
    expect(
      problemsOf([a, ran(['src/c.ts'], { 'src/c.ts': 1, 'src/x.ts': 1 })]),
    ).toContain('src/x.ts is in the report of shard 2, not in its files');
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

  it('prints the plan of the parts of the files in MUTATION_FILES', () => {
    const { log, error } = output();
    const files = Array.from({ length: 13 }, (_, i) => `src/core/p${i}.ts`);
    const reads = (file: string): string => {
      if (files.includes(file))
        return file === files[0] ? 'x\n'.repeat(99) : 'x';
      throw new Error(file);
    };
    expect(
      main(['parts'], {
        read: reads,
        exists: () => false,
        files: JSON.stringify(files),
      }),
    ).toBe(0);
    const parts = [[files[0]], files.slice(1).sort()];
    expect(log.mock.calls).toEqual([[JSON.stringify(parts)]]);
    expect(error.mock.calls[0]).toEqual([
      '13 files in 2 parts, weighed by their lines (no state of a complete run):',
    ]);
    expect(error.mock.calls).toHaveLength(3);
  });

  it('weighs the parts by the restored state of the last complete run', () => {
    const { log, error } = output();
    const files = ['src/core/x.ts', 'src/core/y.ts'];
    const state = {
      plan: [files],
      weights: { files: { 'src/core/x.ts': { mutants: [{ duration: 5 }] } } },
    };
    const reads = (file: string): string => {
      if (file === 'reports/mutation-state.json') return JSON.stringify(state);
      throw new Error(file);
    };
    const exists = (file: string): boolean =>
      file === 'reports/mutation-state.json';
    expect(
      main(['parts'], { read: reads, exists, files: JSON.stringify(files) }),
    ).toBe(0);
    expect(log.mock.calls).toEqual([[JSON.stringify([files])]]);
    expect(error.mock.calls[0]).toEqual([
      '2 files in 1 parts, weighed by the weights of the last complete run:',
    ]);
  });

  it('weighs by the lines when the state is broken', () => {
    const { error } = output();
    const reads = (file: string): string =>
      file === 'reports/mutation-state.json' ? '{' : 'x';
    expect(
      main(['parts'], {
        read: reads,
        exists: () => true,
        files: '["src/core/x.ts"]',
      }),
    ).toBe(0);
    expect(error.mock.calls[0]![0]).toContain('their lines');
  });

  it('writes the configuration of part n of MUTATION_PLAN', () => {
    const { log } = output();
    const written: [string, string][] = [];
    const write = (file: string, text: string): void => {
      written.push([file, text]);
    };
    const planned = '[["src/a.ts","src/b.ts"],["src/c.ts"]]';
    expect(main(['config', '1'], { read, write, plan: planned })).toBe(0);
    expect(main(['config', '2'], { read, write, plan: planned })).toBe(0);
    expect(written.map(([f]) => f)).toEqual([
      'reports/stryker-partial.config.json',
      'reports/stryker-partial.config.json',
    ]);
    expect(written[0]![1].endsWith('}\n')).toBe(true);
    expect(JSON.parse(written[0]![1])).toEqual(
      partialConfig(stryker, ['src/a.ts', 'src/b.ts']),
    );
    expect(JSON.parse(written[1]![1])).toEqual(
      partialConfig(stryker, ['src/c.ts']),
    );
    expect(log.mock.calls).toEqual([
      [
        'Part 1 of 2: 2 files in reports/stryker-partial.config.json:\n  src/a.ts\n  src/b.ts',
      ],
      [
        'Part 2 of 2: 1 files in reports/stryker-partial.config.json:\n  src/c.ts',
      ],
    ]);
  });

  it('writes nothing without a plan or for a part it does not have', () => {
    const write = vi.fn();
    expect(() =>
      main(['config', '1'], { read, write, plan: undefined }),
    ).toThrow('MUTATION_PLAN is no JSON list of parts of files.');
    for (const n of ['0', '3', '1.5', 'x', undefined])
      expect(() =>
        main(['config', ...(n === undefined ? [] : [n])], {
          read,
          write,
          plan: '[["src/a.ts"],["src/b.ts"]]',
        }),
      ).toThrow(`No part ${n} in a plan of 2 parts.`);
    expect(write).not.toHaveBeenCalled();
  });

  it('reads MUTATION_FILES and MUTATION_PLAN of the environment by default', () => {
    vi.stubEnv('MUTATION_PLAN', '[["src/c.ts"]]');
    vi.stubEnv('MUTATION_FILES', '["src/core/q.ts"]');
    const { log } = output();
    const write = vi.fn();
    expect(main(['config', '1'], { read, write })).toBe(0);
    expect(JSON.parse(write.mock.calls[0]![1] as string).mutate).toEqual([
      'src/c.ts',
    ]);
    expect(main(['parts'], { read: () => 'x', exists: () => false })).toBe(0);
    expect(log.mock.calls.at(-1)).toEqual(['[["src/core/q.ts"]]']);
    vi.unstubAllEnvs();
  });

  /** Writes the reports of the parts as download-artifact lays them out. */
  const downloaded = (layout: Record<string, unknown>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'parts-'));
    for (const [file, report] of Object.entries(layout)) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), JSON.stringify(report));
    }
    return dir;
  };
  const ran = (mutate: string[]) => ({ config: { mutate }, files: {} });
  /** merge with the real file system below <dir>, the stryker config faked. */
  const mergeIn = (dir: string, plan: string, write = vi.fn()) => ({
    code: main(['merge', 'out.json', dir], {
      read: (file) =>
        file === 'stryker.config.json'
          ? JSON.stringify(stryker)
          : readFileSync(file, 'utf8'),
      write,
      plan,
    }),
    write,
  });

  it('merges a single part whose report lies straight in the folder (one artifact, #370)', () => {
    const { log } = output();
    const dir = downloaded({ 'mutation.json': ran(['src/a.ts']) });
    const { code, write } = mergeIn(dir, '[["src/a.ts"]]');
    expect(code).toBe(0);
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0]![1] as string)).toEqual({
      config: { mutate: ['src/a.ts'] },
      files: {},
      thresholds: stryker.thresholds,
    });
    expect(log.mock.calls).toEqual([
      ['1 reports of the parts merged into out.json.'],
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('merges the parts whose reports lie in a folder each (several artifacts)', () => {
    const { log } = output();
    const dir = downloaded({
      'mutation-partial-part-1/mutation.json': ran(['src/a.ts']),
      'mutation-partial-part-2/mutation.json': ran(['src/b.ts']),
      'mutation-partial-part-2/other.json': { x: 1 },
    });
    const { code, write } = mergeIn(dir, '[["src/a.ts"],["src/b.ts"]]');
    expect(code).toBe(0);
    expect(write.mock.calls[0]![0]).toBe('out.json');
    expect(JSON.parse(write.mock.calls[0]![1] as string).config).toEqual({
      mutate: ['src/a.ts', 'src/b.ts'],
    });
    expect(log.mock.calls).toEqual([
      ['2 reports of the parts merged into out.json.'],
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes nothing and fails when a report is missing', () => {
    const { log } = output();
    const dir = downloaded({
      'mutation-partial-part-1/mutation.json': ran(['src/a.ts']),
    });
    const { code, write } = mergeIn(dir, '[["src/a.ts"],["src/b.ts"]]');
    expect(code).toBe(1);
    expect(write).not.toHaveBeenCalled();
    expect(log.mock.calls).toEqual([
      [
        `::error::Partial mutation run: 1 reports below ${dir} (${join(dir, 'mutation-partial-part-1/mutation.json')}), the plan has 2 parts`,
      ],
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes nothing and fails for a folder without any report', () => {
    const { log } = output();
    const dir = downloaded({});
    const { code, write } = mergeIn(dir, '[["src/a.ts"]]');
    expect(code).toBe(1);
    expect(write).not.toHaveBeenCalled();
    expect(log.mock.calls).toEqual([
      [
        `::error::Partial mutation run: 0 reports below ${dir} (none), the plan has 1 parts`,
      ],
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes nothing and fails for an extra report', () => {
    const { log } = output();
    const dir = downloaded({
      'mutation-partial-part-1/mutation.json': ran(['src/a.ts']),
      'mutation-partial-part-2/mutation.json': ran(['src/a.ts']),
    });
    const { code, write } = mergeIn(dir, '[["src/a.ts"]]');
    expect(code).toBe(1);
    expect(write).not.toHaveBeenCalled();
    expect(log.mock.calls[0]![0]).toMatch(
      /^::error::Partial mutation run: 2 reports below .*, the plan has 1 parts$/,
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the check that each part ran exactly its files', () => {
    const { log } = output();
    const dir = downloaded({
      'mutation-partial-part-1/mutation.json': ran(['src/a.ts']),
      'mutation-partial-part-2/mutation.json': ran(['src/a.ts']),
    });
    const { code, write } = mergeIn(dir, '[["src/a.ts"],["src/b.ts"]]');
    expect(code).toBe(1);
    expect(write).not.toHaveBeenCalled();
    expect(log.mock.calls).toEqual([
      ['::error::Partial mutation run: shard 1 has 2 reports'],
      ['::error::Partial mutation run: shard 2 has 0 reports'],
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('finds every mutation.json below a folder, at any depth, sorted', () => {
    const dir = downloaded({
      'b/mutation.json': {},
      'a/deep/mutation.json': {},
      'mutation.json': {},
      'a/report.json': {},
    });
    expect(reportsIn(dir)).toEqual(
      [
        join(dir, 'a/deep/mutation.json'),
        join(dir, 'b/mutation.json'),
        join(dir, 'mutation.json'),
      ].sort(),
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('needs the merged file and exactly one folder', () => {
    const { error } = output();
    expect(main(['merge'], { read })).toBe(1);
    expect(main(['merge', 'out.json'], { read })).toBe(1);
    expect(main(['merge', 'out.json', 'a', 'b'], { read })).toBe(1);
    expect(error.mock.calls).toEqual([
      ['Usage: mutation-partial.ts merge <out> <dir>'],
      ['Usage: mutation-partial.ts merge <out> <dir>'],
      ['Usage: mutation-partial.ts merge <out> <dir>'],
    ]);
  });

  it('names its commands', () => {
    const { error } = output();
    expect(main([], {})).toBe(1);
    expect(main(['split'], {})).toBe(1);
    expect(error.mock.calls).toEqual([
      [
        'Usage: mutation-partial.ts plan <from> [<to>] | parts | config <n> | merge <out> <dir>',
      ],
      [
        'Usage: mutation-partial.ts plan <from> [<to>] | parts | config <n> | merge <out> <dir>',
      ],
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
    expect(partial).toContain('    name: Mutation tests (changed files)\n');
    const part = job('mutation-partial-part');
    expect(part).toContain(
      'Mutation tests (changed files, part ${{ matrix.part }} of ${{ strategy.job-total }})',
    );
    for (const text of [partial, part])
      for (const word of complete) expect(text).not.toContain(word);
  });

  it('restores the weights of main in "Detect changes" read only (#370)', () => {
    const changes = job('changes');
    expect(changes).toContain('actions/cache/restore@');
    expect(changes).not.toMatch(/actions\/cache@|actions\/cache\/save@/);
  });

  it('runs only for the output "partial" and only after "Detect changes"', () => {
    const part = job('mutation-partial-part');
    expect(part).toContain('    needs: changes\n');
    expect(part).toContain("if: needs.changes.outputs.mutation == 'partial'\n");
    expect(part).toContain(
      "part: ${{ fromJSON(needs.changes.outputs.mutation-parts || '[1]') }}",
    );
    expect(part).toContain(
      'MUTATION_PLAN: ${{ needs.changes.outputs.mutation-plan }}',
    );
    const partial = job('mutation-partial');
    expect(partial).toContain('needs: [changes, mutation-partial-part]\n');
    expect(partial).toContain(
      "if: needs.changes.outputs.mutation == 'partial'\n",
    );
    expect(partial).toContain(
      'MUTATION_FILES: ${{ needs.changes.outputs.mutation-files }}',
    );
    expect(partial).toContain(
      'MUTATION_PLAN: ${{ needs.changes.outputs.mutation-plan }}',
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
    expect(job('gate')).toContain('        mutation-partial-part,\n');
    expect(job('gate')).toContain(
      'MUTATION_PARTIAL_PARTS: ${{ needs.mutation-partial-part.result }}',
    );
    expect(job('gate')).toContain(
      'MUTATION_PARTIAL: ${{ needs.mutation-partial.result }}',
    );
  });
});
