import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
  costs,
  coverage,
  cuts,
  dropStatic,
  entryOf,
  join,
  merge,
  type Mutant,
  mutatedFiles,
  pieces,
  planOf,
  prune,
  type Report,
  reportOf,
  reweigh,
  SHARDS,
  shardConfig,
  shardNumbers,
  split,
  units,
  weigh,
  withoutStatic,
} from '../../scripts/mutation-shards.ts';

const stryker = JSON.parse(readFileSync('stryker.config.json', 'utf8'));
const lines = (file: string) => readFileSync(file, 'utf8').split('\n').length;
const mutants = (n: number) => Array.from({ length: n }, () => ({}));
const sum = (files: string[], w: Record<string, number>) =>
  files.reduce((total, f) => total + w[f]!, 0);
const at = (line: number, end = line, extra: Partial<Mutant> = {}): Mutant => ({
  location: {
    start: { line, column: 2 },
    end: { line: end, column: 9 },
  },
  mutatorName: 'StringLiteral',
  replacement: '""',
  ...extra,
});
const report = (mutate: string[], files: string[]): Report => ({
  config: { mutate },
  files: Object.fromEntries(files.map((f) => [f, { mutants: mutants(1) }])),
});

describe('mutation shards: the files', () => {
  it('applies the patterns in order; "!" removes what it matches', () => {
    const tree: Record<string, string[]> = {
      'src/a/**/*.ts': ['src/a/x.ts', 'src/a/x.test.ts', 'src/a/b/y.ts'],
      'src/c/*.ts': ['src/c/z.ts', 'src/a/x.ts'],
    };
    const glob = (p: string) => tree[p] ?? [];
    expect(
      mutatedFiles(['src/a/**/*.ts', '!**/*.test.ts', 'src/c/*.ts'], glob),
    ).toEqual(['src/a/b/y.ts', 'src/a/x.ts', 'src/c/z.ts']);
    expect(mutatedFiles(['src/a/**/*.ts', '!src/a/b/**'], glob)).toEqual([
      'src/a/x.test.ts',
      'src/a/x.ts',
    ]);
    expect(
      mutatedFiles(['src/c/*.ts'], () => ['src\\c\\z.ts', 'src/c/a.ts']),
    ).toEqual(['src/c/a.ts', 'src/c/z.ts']);
  });

  it('finds the files of stryker.config.json, without tests and entry points', () => {
    const files = mutatedFiles(stryker.mutate);
    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain('src/core/economy.ts');
    expect(files).toContain('src/client/logic/format.ts');
    expect(files.filter((f) => f.endsWith('.test.ts'))).toEqual([]);
    for (const left of [
      'src/server/main.ts',
      'src/server/cli.ts',
      'src/server/db/migrate-worker.ts',
      'src/server/test-helpers.ts',
    ])
      expect(files).not.toContain(left);
    expect(files.filter((f) => f.startsWith('src/test/'))).toEqual([]);
    expect(files.filter((f) => f.startsWith('src/client/views/'))).toEqual([]);
    // Display texts are not mutated (owner, 2026-11-12); the rules are. The
    // texts of each entry are in its folder since #113 (owner, 2026-11-13).
    expect(files).not.toContain('src/core/texts.ts');
    expect(files).toContain('src/core/catalog.ts');
    expect(files.filter((f) => f.endsWith('texts.de.ts'))).toEqual([]);
    expect(files).toContain('src/core/text.ts');
    expect(files).toContain('src/features/metal/entry.ts');
  });

  it('weighs a file by its mutants in the last report, a file without a weight as the mean file with one', () => {
    const last: Report = {
      files: {
        'a.ts': { mutants: mutants(7) },
        'b.ts': { mutants: [] },
        'd.ts': { mutants: mutants(3) },
      },
    };
    const length = (f: string) => ({ 'a.ts': 100, 'b.ts': 50, 'c.ts': 30 })[f]!;
    // b.ts is known and empty: it weighs 0 and does not lower the mean (7 + 3) / 2
    expect(
      weigh(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'], last, length),
    ).toEqual({ 'a.ts': 7, 'b.ts': 0, 'c.ts': 5, 'd.ts': 3, 'e.ts': 5 });
    // the lines do not matter any more, as long as some file has a weight
    expect(weigh(['a.ts', 'c.ts', 'd.ts'], last, () => 1e6)['c.ts']).toBe(5);
  });

  it('weighs a file by its lines when no file has a weight', () => {
    const length = (f: string) => ({ 'a.ts': 100, 'c.ts': 30 })[f]!;
    expect(weigh(['a.ts', 'c.ts'], undefined, length)).toEqual({
      'a.ts': 100,
      'c.ts': 30,
    });
    const empty: Report = { files: { 'b.ts': { mutants: [] } } };
    expect(weigh(['a.ts', 'b.ts', 'c.ts'], empty, length)).toEqual({
      'a.ts': 100,
      'b.ts': 0,
      'c.ts': 30,
    });
  });

  it('counts the mean file in the time of the mutants, static ones included', () => {
    const last: Report = {
      files: {
        'a.ts': { mutants: [{ duration: 10 }, { duration: 30 }] },
        'b.ts': { mutants: [{ duration: 920, static: true }] },
      },
    };
    expect(weigh(['a.ts', 'b.ts', 'new.ts'], last, () => 1)).toEqual({
      'a.ts': 40,
      'b.ts': 920,
      'new.ts': 480,
    });
  });
});

describe('mutation shards: the cost', () => {
  it('weighs a mutant by its test time, a missing one by the mean of its kind', () => {
    const last: Report = {
      files: {
        'a.ts': {
          mutants: [
            { duration: 10 },
            { duration: 30 },
            { duration: 4000, static: true },
            { static: true },
            {},
          ],
        },
        'b.ts': { mutants: [{ duration: 2000, static: true }] },
      },
    };
    const cost = costs(last);
    // static mean (4000 + 2000) / 2, other mean (10 + 30) / 2
    expect(cost.mutant({ static: true })).toBe(3000);
    expect(cost.mutant({})).toBe(20);
    expect(cost.mutant({ duration: 7, static: true })).toBe(7);
    expect(cost.line).toBe(20);
    const length = (f: string) => ({ 'c.ts': 5 })[f]!;
    expect(weigh(['a.ts', 'b.ts', 'c.ts'], last, length)).toEqual({
      'a.ts': 10 + 30 + 4000 + 3000 + 20,
      'b.ts': 2000,
      // the mean of the two files that have a weight
      'c.ts': (7060 + 2000) / 2,
    });
  });

  it('falls back to the other kind, and to counting without any time', () => {
    const onlyStatic = costs({
      files: { 'a.ts': { mutants: [{ duration: 600, static: true }] } },
    });
    expect(onlyStatic.mutant({})).toBe(600);
    expect(onlyStatic.line).toBe(600);
    const onlyOther = costs({
      files: { 'a.ts': { mutants: [{ duration: 8 }] } },
    });
    expect(onlyOther.mutant({ static: true })).toBe(8);
    const untimed: (Report | undefined)[] = [
      undefined,
      { files: {} },
      { files: { 'a.ts': { mutants: [{}] } } },
    ];
    for (const none of untimed) {
      const cost = costs(none);
      expect(cost.mutant({ duration: 50, static: true })).toBe(1);
      expect(cost.line).toBe(1);
    }
  });
});

describe('mutation shards: cutting a large file', () => {
  const source = [
    "import { x } from './x.ts';", // 1
    '', // 2
    'export const A = {', // 3
    "  a: 'a',", // 4
    '};', // 5
    '// about B', // 6
    'export const B = [1,', // 7
    '  2];', // 8
    'const C = 1; const D = 2;', // 9
    'export function f() {', // 10
    '  return C + D;', // 11
    '}', // 12
  ].join('\n');

  it('cuts after a top-level statement, not between two on one line', () => {
    expect(cuts('x.ts', source)).toEqual([1, 5, 8, 9]);
  });

  it('reads a mutate entry: a file or its lines', () => {
    expect(entryOf('src/a.ts')).toEqual({ file: 'src/a.ts' });
    expect(entryOf('src/a.ts:3-17')).toEqual({
      file: 'src/a.ts',
      from: 3,
      to: 17,
    });
    expect(entryOf('src/a.ts:3')).toEqual({ file: 'src/a.ts:3' });
  });

  it('weighs each piece by the mutants starting in it; empty pieces join a neighbour', () => {
    const mutants = [at(4), at(4), at(7, 8), at(11)];
    expect(pieces('x.ts', source, mutants, () => 5)).toEqual({
      'x.ts:1-5': 10,
      'x.ts:6-9': 5,
      'x.ts:10-12': 5,
    });
    expect(pieces('x.ts', source, [at(11)], () => 5)).toEqual({
      'x.ts:1-12': 5,
    });
    expect(pieces('x.ts', source, [], () => 5)).toEqual({ 'x.ts:1-12': 0 });
  });

  it('cuts only TypeScript files heavier than half a shard into pieces', () => {
    const read = (f: string) =>
      f === 'big.ts' ? source : 'const a = 1;\nconst b = 2;';
    const last: Report = {
      files: { 'big.ts': { mutants: [at(4), at(7), at(11)] } },
    };
    // total 120, half a shard of 4 is 15
    expect(
      units({ 'big.ts': 60, 'small.ts': 15, 'big.svelte': 45 }, last, read, 4),
    ).toEqual({
      'big.ts:1-5': 1,
      'big.ts:6-9': 1,
      'big.ts:10-12': 1,
      'small.ts': 15,
      'big.svelte': 45,
    });
    // one piece only: the file stays whole
    expect(
      units({ 'one.ts': 60, 'b.ts': 1 }, undefined, () => 'const a = 1;'),
    ).toEqual({
      'one.ts': 60,
      'b.ts': 1,
    });
  });

  it('joins neighbouring pieces of a shard, and a file with all pieces on one shard', () => {
    expect(
      join([
        ['b.ts:1-5', 'a.ts', 'b.ts:9-12'],
        ['b.ts:6-8', 'c.ts:1-4', 'c.ts:5-9'],
        ['d.ts:10-20', 'd.ts:1-9', 'd.ts:21-30'],
        [],
      ]),
    ).toEqual([
      ['a.ts', 'b.ts:1-5', 'b.ts:9-12'],
      ['b.ts:6-8', 'c.ts'],
      ['d.ts'],
      [],
    ]);
    expect(join([['e.ts:1-3', 'e.ts:7-9'], ['e.ts:4-6']])).toEqual([
      ['e.ts:1-3', 'e.ts:7-9'],
      ['e.ts:4-6'],
    ]);
    expect(join([['f.ts:5-9', 'f.ts:1-4'], ['g.ts']])).toEqual([
      ['f.ts'],
      ['g.ts'],
    ]);
  });

  it('cuts the real catalog so that every top-level statement lies in one piece', () => {
    const file = 'src/core/catalog.ts';
    const text = readFileSync(file, 'utf8');
    const ranges = Object.keys(pieces(file, text, [], () => 1)).map(entryOf);
    expect(ranges).toEqual([{ file, from: 1, to: lines(file) }]);
    const at = [0, ...cuts(file, text), lines(file)];
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const line = (pos: number) =>
      sf.getLineAndCharacterOfPosition(pos).line + 1;
    expect(at.length).toBeGreaterThan(5);
    for (const statement of sf.statements) {
      const from = line(statement.getStart(sf));
      const to = line(statement.end);
      const piece = at.findIndex((cut) => cut >= from);
      expect(at[piece]! >= to, `${from}-${to}`).toBe(true);
    }
  });
});

describe('mutation shards: the split', () => {
  it('puts the largest file first onto the emptiest shard', () => {
    expect(split({ a: 1, b: 5, c: 4, d: 3, e: 3, f: 2, g: 2 }, 3)).toEqual([
      ['b', 'g'],
      ['a', 'c', 'f'],
      ['d', 'e'],
    ]);
  });

  it('is the same for the same weights, whatever their order', () => {
    const w = { x: 3, a: 3, m: 3, b: 1, c: 8 };
    const reversed = Object.fromEntries(Object.entries(w).reverse());
    expect(split(reversed, 4)).toEqual(split(w, 4));
    expect(split(w, 4)).toEqual([['c'], ['a', 'b'], ['m'], ['x']]);
    expect(split(reversed)).toEqual(split(w));
  });

  it('leaves a shard empty when there are fewer files than shards', () => {
    expect(split({ a: 2, b: 1 }, 4)).toEqual([['a'], ['b'], [], []]);
  });

  it('splits into 12 shards by default (owner, 2026-11-20; 6 before)', () => {
    expect(SHARDS).toBe(12);
    const w = Object.fromEntries(
      'abcdefghijklmn'.split('').map((f, i) => [f, 14 - i]),
    );
    const plan = split(w);
    expect(plan).toHaveLength(12);
    // the two lightest files join the two lightest shards, the lighter first
    expect(plan.slice(0, 10)).toEqual('abcdefghij'.split('').map((f) => [f]));
    expect(plan.slice(10)).toEqual([
      ['k', 'n'],
      ['l', 'm'],
    ]);
  });

  it('splits the real files completely, once each, and balanced', () => {
    const files = mutatedFiles(stryker.mutate);
    const w = weigh(files, undefined, lines);
    const plan = split(w);
    expect(plan).toHaveLength(SHARDS);
    expect(plan.flat().sort()).toEqual(files);
    expect(new Set(plan.flat()).size).toBe(files.length);
    const loads = plan.map((shard) => sum(shard, w));
    const heaviest = Math.max(...Object.values(w));
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(
      heaviest,
    );
    for (const shard of plan) expect(shard).toEqual([...shard].sort());
  });

  it('stays complete and balanced for many weights (largest first)', () => {
    const w: Record<string, number> = {};
    for (let i = 0; i < 101; i++) w[`f${i}.ts`] = (i * 37) % 53;
    const plan = split(w);
    expect(plan.flat().sort()).toEqual(Object.keys(w).sort());
    const loads = plan.map((shard) => sum(shard, w));
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(52);
  });
});

describe('mutation shards: the plan of a run', () => {
  /** n files f00.ts … with growing lengths. */
  const names = (n: number): string[] =>
    Array.from(
      { length: n },
      (_, i) => `src/f${String(i).padStart(2, '0')}.ts`,
    );
  const length = (file: string): number => 10 + Number(file.slice(5, 7));
  const none = (): string => '';
  /** A report in which each of the given files has one mutant of this time. */
  const timed = (times: Record<string, number>): Report => ({
    files: Object.fromEntries(
      Object.entries(times).map(([f, t]) => [
        f,
        { mutants: [{ duration: t }] },
      ]),
    ),
  });
  const every = (plan: string[][], files: string[]): void => {
    expect(plan.flat().sort()).toEqual([...files].sort());
    expect(new Set(plan.flat()).size).toBe(files.length);
  };
  const loadOf = (shard: string[], w: Record<string, number>): number =>
    shard.reduce((t, f) => t + w[f]!, 0);

  it('splits files with a weight into the shards by their weight, each file once', () => {
    const files = names(40);
    const times = Object.fromEntries(files.map((f, i) => [f, 100 + i * 7]));
    const { plan, whole } = planOf(
      files,
      timed(times),
      undefined,
      length,
      none,
    );
    expect(plan).toHaveLength(SHARDS);
    every(plan, files);
    expect(whole).toEqual(times);
    const loads = plan.map((shard) => loadOf(shard, whole));
    // the largest file first onto the emptiest shard: the spread is below one file
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(
      Math.max(...Object.values(times)),
    );
  });

  it('splits files without any weight by their lines', () => {
    const files = names(30);
    const { plan, whole } = planOf(files, undefined, undefined, length, none);
    expect(whole).toEqual(Object.fromEntries(files.map((f) => [f, length(f)])));
    every(plan, files);
    expect(plan).toEqual(split(whole));
  });

  it('weighs a file without a weight as the mean file with one, so new files spread out', () => {
    const files = names(36);
    const known = files.slice(0, 24);
    const times = Object.fromEntries(known.map((f, i) => [f, 50 + i * 10]));
    const mean = Object.values(times).reduce((t, w) => t + w, 0) / 24;
    const { plan, whole } = planOf(
      files,
      timed(times),
      undefined,
      length,
      none,
    );
    for (const f of files.slice(24)) expect(whole[f]).toBe(mean);
    every(plan, files);
    // the lengths of the twelve new files do not matter: they lie on at
    // least ten shards, not on the few that their lengths would pick
    const shardsWithNew = plan.filter((s) => s.some((f) => !known.includes(f)));
    expect(shardsWithNew.length).toBeGreaterThanOrEqual(10);
    const loads = plan.map((shard) => loadOf(shard, whole));
    expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(mean);
  });

  it('keeps the files with a weight on their shard of the last plan and puts the new ones on the lightest', () => {
    const files = names(26);
    const known = files.slice(0, 24);
    const times = Object.fromEntries(
      known.map((f, i) => [f, 100 + (i % 5) * 20]),
    );
    const last = split(times);
    const { plan, settled } = planOf(files, timed(times), last, length, none);
    expect(settled.added).toEqual(files.slice(24));
    expect(settled.moved).toEqual([]);
    for (const [s, shard] of last.entries())
      expect(plan[s]).toEqual(expect.arrayContaining(shard));
    every(plan, files);
    // the two new files, as heavy as the mean of the 24 (140), go onto the
    // two lightest shards
    const lastLoads = last.map((shard) => loadOf(shard, times));
    const lightest = [...lastLoads.keys()]
      .sort((a, b) => lastLoads[a]! - lastLoads[b]! || a - b)
      .slice(0, 2);
    for (const f of files.slice(24))
      expect(lightest).toContain(plan.findIndex((shard) => shard.includes(f)));
  });

  it('gives the same plan for the same input, whatever the order of the files and the weights', () => {
    const files = names(50);
    const times = Object.fromEntries(
      files.slice(0, 35).map((f, i) => [f, 20 + ((i * 37) % 91)]),
    );
    const a = planOf(files, timed(times), undefined, length, none);
    const reversed = Object.fromEntries(Object.entries(times).reverse());
    const b = planOf(
      [...files].reverse(),
      timed(reversed),
      undefined,
      length,
      none,
    );
    expect(b.plan).toEqual(a.plan);
    expect(planOf(files, timed(times), a.plan, length, none).plan).toEqual(
      a.plan,
    );
  });

  it('plans any number of shards: every file once, none empty while there are files', () => {
    const files = names(20);
    const times = Object.fromEntries(files.slice(0, 12).map((f) => [f, 90]));
    for (const shards of [1, 2, 3, 12, 20, 25]) {
      const { plan } = planOf(
        files,
        timed(times),
        undefined,
        length,
        none,
        shards,
      );
      expect(plan).toHaveLength(shards);
      every(plan, files);
      if (shards <= files.length)
        for (const shard of plan) expect(shard.length).toBeGreaterThan(0);
    }
  });

  it('cuts a heavy file into pieces at 12 shards that stays whole at 3', () => {
    const source = Array.from(
      { length: 40 },
      (_, i) => `export const x${i} = ${i};`,
    ).join('\n');
    const file = 'src/big.ts';
    const others = names(23);
    const big: Report = {
      files: {
        [file]: {
          mutants: Array.from({ length: 40 }, (_, i) =>
            at(i + 1, i + 1, { duration: 10 }),
          ),
        },
        ...timed(Object.fromEntries(others.map((f) => [f, 100]))).files,
      },
    };
    // the file weighs 400 of 2700: above half a shard of 12 (112.5), below
    // half a shard of 3 (450)
    const read = (f: string): string => (f === file ? source : '');
    const files = [file, ...others];
    const at12 = planOf(files, big, undefined, length, read, 12).plan;
    const at3 = planOf(files, big, undefined, length, read, 3).plan;
    expect(
      at12.flat().filter((e) => e.startsWith(`${file}:`)).length,
    ).toBeGreaterThan(1);
    expect(at3.flat()).toContain(file);
  });
});

describe('mutation shards: the weights after a run', () => {
  it('knows the files of the plan that the report leaves out, with no mutants', () => {
    const run: Report = {
      files: { 'a.ts': { mutants: [at(1, 1, { duration: 5 })] } },
    };
    const weights = reweigh(undefined, run, [
      'a.ts',
      'types.ts',
      'cut.ts:1-9',
      'cut.ts:10-20',
    ]);
    expect(Object.keys(weights.files).sort()).toEqual([
      'a.ts',
      'cut.ts',
      'types.ts',
    ]);
    expect(weights.files['types.ts']).toEqual({ mutants: [] });
    expect(weights.files['a.ts']!.mutants).toHaveLength(1);
    // a file that is gone from the plan and the report drops out
    expect(Object.keys(reweigh(weights, run, ['a.ts']).files)).toEqual([
      'a.ts',
    ]);
  });

  it('weighs such a file 0 in the next plan instead of as a new file', () => {
    const run: Report = {
      files: { 'a.ts': { mutants: [at(1, 1, { duration: 40 })] } },
    };
    const state = reweigh(undefined, run, ['a.ts', 'types.ts', 'index.ts']);
    const files = ['a.ts', 'types.ts', 'index.ts', 'new.ts'];
    expect(weigh(files, state, () => 99)).toEqual({
      'a.ts': 40,
      'types.ts': 0,
      'index.ts': 0,
      'new.ts': 40,
    });
  });
});

describe('mutation shards: the number of shards', () => {
  const workflow = (name: string): string =>
    readFileSync(`.github/workflows/${name}`, 'utf8');
  const plan = [['a.ts'], ['b.ts'], ['c.ts']];
  const numbers = (env: string) =>
    spawnSync('node', ['scripts/mutation-shards.ts', 'numbers'], {
      encoding: 'utf8',
      env: { ...process.env, MUTATION_PLAN: env },
    });

  it('lists the numbers of the shards of a plan', () => {
    expect(shardNumbers(plan)).toEqual([1, 2, 3]);
    expect(shardNumbers([])).toEqual([]);
    expect(shardNumbers(split({ a: 1 }))).toEqual(
      Array.from({ length: SHARDS }, (_, i) => i + 1),
    );
  });

  it('prints them for the matrix of the jobs', () => {
    const result = numbers(JSON.stringify(plan));
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([1, 2, 3]);
    expect(numbers('').status).not.toBe(0);
  });

  it('is written once: the matrix and the names of the jobs follow the plan', () => {
    for (const name of ['ci.yml', 'mutation.yml']) {
      const text = workflow(name);
      // no list of shard numbers, no number in a job name
      expect(text).not.toMatch(/shard: \[/);
      expect(text).not.toMatch(/shard \$\{\{ matrix\.shard \}\} of \d/);
      expect(text).toContain('of ${{ strategy.job-total }})');
      expect(text).toContain(
        'shard: ${{ fromJSON(needs.mutation-plan.outputs.shards',
      );
      expect(text).toContain('      shards: ${{ steps.plan.outputs.shards }}');
      expect(text).toContain(
        'shards=$(MUTATION_PLAN="$plan" node scripts/mutation-shards.ts numbers)',
      );
    }
    // the plan job of the CI may be skipped: its empty output keeps the matrix valid
    expect(workflow('ci.yml')).toContain(
      "fromJSON(needs.mutation-plan.outputs.shards || '[1]')",
    );
  });
});

describe('mutation shards: one shard', () => {
  const plan = [['a.ts', 'b.ts'], ['c.ts'], ['d.ts'], ['e.ts']];

  it('mutates only its files and leaves the break threshold to the gate', () => {
    const config = shardConfig(stryker, plan, 1);
    expect(config.mutate).toEqual(['a.ts', 'b.ts']);
    expect(config.thresholds).toEqual({ high: 90, low: 80, break: null });
    expect(config.$schema).toBeUndefined();
    expect(config).toEqual({
      ...stryker,
      $schema: undefined,
      mutate: ['a.ts', 'b.ts'],
      thresholds: { high: 90, low: 80, break: null },
    });
    expect(Object.keys(config)).not.toContain('$schema');
    expect(stryker.thresholds.break).toBe(80);
    expect(shardConfig(stryker, plan, 4).mutate).toEqual(['e.ts']);
  });

  it('refuses a shard the plan does not have', () => {
    for (const n of [0, 5, 1.5, Number.NaN])
      expect(() => shardConfig(stryker, plan, n)).toThrow(
        `No shard ${n} in a plan of 4 shards.`,
      );
  });

  it('keeps only its own files of the incremental result', () => {
    const last: Report = {
      testFiles: { 't.test.ts': {} },
      files: {
        'a.ts': { mutants: mutants(1) },
        'c.ts': { mutants: mutants(2) },
      },
    };
    expect(prune(last, plan[0]!)).toEqual({
      testFiles: { 't.test.ts': {} },
      files: { 'a.ts': { mutants: mutants(1) } },
    });
    expect(Object.keys(last.files)).toEqual(['a.ts', 'c.ts']);
  });
});

describe('mutation shards: a file cut into ranges', () => {
  const plan = [
    ['a.ts', 'cat.ts:1-50'],
    ['cat.ts:51-80', 'cat.ts:91-100'],
    ['cat.ts:81-90'],
    ['b.ts'],
  ];
  const lengths = (f: string) => ({ 'cat.ts': 100 })[f]!;
  const shard = (mutate: string[], mutants: Mutant[]): Report => ({
    config: { mutate },
    files: { 'cat.ts': { mutants } },
  });
  const reports = [
    {
      ...shard(plan[0]!, [at(3), at(50)]),
      files: {
        'a.ts': { mutants: [at(1)] },
        'cat.ts': { mutants: [at(3), at(50)] },
      },
    },
    shard(plan[1]!, [at(51, 80), at(95)]),
    shard(plan[2]!, [at(81), at(90)]),
    report(['b.ts'], ['b.ts']),
  ];

  it('keeps only the mutants of its ranges of the incremental result', () => {
    const last: Report = {
      files: {
        'cat.ts': {
          source: 'v1',
          mutants: [at(3), at(50, 51), at(60), at(95), at(100, 101)],
        },
        'a.ts': { mutants: [at(1)] },
        'z.ts': { mutants: [at(1)] },
      },
    };
    const same = (f: string) => (f === 'cat.ts' ? 'v1' : undefined);
    const cat = (mutants: Mutant[]) => ({ source: 'v1', mutants });
    expect(prune(last, plan[1]!, same)).toEqual({
      files: { 'cat.ts': cat([at(60), at(95)]) },
    });
    expect(prune(last, plan[0]!, same)).toEqual({
      files: { 'cat.ts': cat([at(3)]), 'a.ts': { mutants: [at(1)] } },
    });
    expect(prune(last, ['cat.ts:1-50', 'cat.ts'], same)).toEqual({
      files: { 'cat.ts': last.files['cat.ts']! },
    });
  });

  it('drops the cache of a cut file whose source changed or is unknown', () => {
    // Stryker moves the cached mutants of a changed file to their new lines
    // and reports one outside the ranges again, so the old lines tell nothing.
    const last: Report = {
      files: {
        'cat.ts': { source: 'v1', mutants: [at(3), at(60)] },
        'a.ts': { source: 'old', mutants: [at(1)] },
        'old.ts': { mutants: [at(1)] },
      },
    };
    const changed = (f: string) => ({ 'cat.ts': 'v2', 'a.ts': 'new' })[f];
    expect(prune(last, [...plan[0]!, 'old.ts:1-9'], changed)).toEqual({
      files: { 'a.ts': { source: 'old', mutants: [at(1)] } },
    });
    expect(prune(last, plan[1]!)).toEqual({ files: {} });
    expect(prune(last, ['cat.ts'], changed)).toEqual({
      files: { 'cat.ts': last.files['cat.ts']! },
    });
  });

  it('accepts the shards of a cut file and joins its mutants', () => {
    expect(coverage(plan, reports, lengths)).toEqual([]);
    const merged = merge(reports, stryker.thresholds);
    expect(merged.files['cat.ts']!.mutants).toEqual([
      at(3),
      at(50),
      at(51, 80),
      at(95),
      at(81),
      at(90),
    ]);
    expect(merged.files['a.ts']!.mutants).toEqual([at(1)]);
  });

  it('names a mutant outside the lines of its shard, and one reported twice', () => {
    const wrong = [
      reports[0]!,
      shard(plan[1]!, [at(51, 80), at(95), at(45)]),
      reports[2]!,
      reports[3]!,
    ];
    expect(coverage(plan, wrong, lengths)).toEqual([
      'cat.ts: 1 mutants in the report of shard 2 are outside its lines',
    ]);
    const twice = [
      reports[0]!,
      reports[1]!,
      shard(plan[2]!, [at(81), at(95)]),
      reports[3]!,
    ];
    expect(coverage(plan, twice, lengths)).toEqual([
      'cat.ts: 1 mutants in the report of shard 3 are outside its lines',
      'cat.ts: the mutant 95:2-95:9 StringLiteral "" is in two shard reports',
    ]);
  });

  it('names lines in no shard or in two, and a file both whole and cut', () => {
    const gaps = [
      ['cat.ts:3-50'],
      ['cat.ts:40-60'],
      ['cat.ts:70-90'],
      ['cat.ts'],
    ];
    const runs = gaps.map((mutate) => ({ config: { mutate }, files: {} }));
    expect(coverage(gaps, runs, lengths)).toEqual([
      'cat.ts is in the plan whole and in ranges',
      'cat.ts: lines 1-2 are in no shard',
      'cat.ts: lines 40-50 are in two shards',
      'cat.ts: lines 61-69 are in no shard',
      'cat.ts: lines 91-100 are in no shard',
    ]);
    expect(coverage(gaps.slice(0, 3), runs.slice(0, 3))).toEqual([
      'cat.ts: lines 1-2 are in no shard',
      'cat.ts: lines 40-50 are in two shards',
      'cat.ts: lines 61-69 are in no shard',
    ]);
  });
});

describe('mutation shards: the merge', () => {
  const plan = [['a.ts', 'b.ts'], ['c.ts'], ['d.ts'], ['e.ts']];
  const complete = [
    report(['e.ts'], ['e.ts']),
    report(['b.ts', 'a.ts'], ['a.ts']),
    report(['c.ts'], ['c.ts']),
    report(['d.ts'], ['d.ts']),
  ];

  it('accepts every shard once with its files; files without mutants may be missing', () => {
    expect(coverage(plan, complete)).toEqual([]);
  });

  it('names a missing shard, a shard run twice and a run that is no shard', () => {
    expect(coverage(plan, complete.slice(0, 3))).toEqual([
      'shard 3 has 0 reports',
    ]);
    expect(coverage(plan, [...complete, report(['c.ts'], [])])).toEqual([
      'shard 2 has 2 reports',
    ]);
    expect(
      coverage(plan, [...complete.slice(1), report(['e.ts', 'x.ts'], [])]),
    ).toEqual([
      'report 4 ran files that are no shard of the plan',
      'shard 4 has 0 reports',
    ]);
    expect(coverage(plan, [...complete.slice(1), { files: {} }])).toEqual([
      'report 4 ran files that are no shard of the plan',
      'shard 4 has 0 reports',
    ]);
  });

  it('names a file reported by a shard it does not belong to', () => {
    const stale = [...complete.slice(0, 3), report(['d.ts'], ['d.ts', 'c.ts'])];
    expect(coverage(plan, stale)).toEqual([
      'c.ts is in the report of shard 3, not in its files',
      'c.ts is in two shard reports',
    ]);
  });

  it('unites the files, takes the thresholds of the configuration and drops the test ids', () => {
    const merged = merge(
      complete.map((r) => ({ ...r, schemaVersion: '1.0', testFiles: {} })),
      stryker.thresholds,
    );
    expect(Object.keys(merged.files).sort()).toEqual([
      'a.ts',
      'c.ts',
      'd.ts',
      'e.ts',
    ]);
    expect(merged.thresholds).toEqual({ high: 90, low: 80, break: 80 });
    expect(merged.schemaVersion).toBe('1.0');
    expect(merged.testFiles).toBeUndefined();
    expect(merged.config).toBeUndefined();
    expect(() => merge([], stryker.thresholds)).toThrow('No report to merge.');
  });
});

describe('mutation shards: static mutants run again (#201)', () => {
  const dir = mkdtempSync(joinPath(tmpdir(), 'nova-static-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const killed = at(3, 3, { static: false, status: 'Killed', killedBy: ['1'] });
  const survived = at(4, 4, { static: false, status: 'Survived' });
  const fixed = (line: number, status: string): Mutant =>
    at(line, line, { static: true, status, coveredBy: [] });
  const cached = (): Report => ({
    schemaVersion: '1.0',
    testFiles: { 'src/a.test.ts': { tests: [{ id: '1', name: 't' }] } },
    files: {
      'src/a.ts': {
        source: 'const a = 1;',
        mutants: [fixed(1, 'Survived'), killed, fixed(2, 'Killed'), survived],
      },
      'src/b.ts': { source: 'b', mutants: [fixed(5, 'RuntimeError')] },
      'src/c.ts': { source: 'c', mutants: [] },
    },
  });
  const write = (name: string, content: string): string => {
    const file = joinPath(dir, name);
    writeFileSync(file, content);
    return file;
  };

  it('removes every static result and keeps every other one', () => {
    const last = cached();
    const { report, dropped } = withoutStatic(last);
    expect(dropped).toBe(3);
    expect(report).toEqual({
      ...cached(),
      files: {
        'src/a.ts': { source: 'const a = 1;', mutants: [killed, survived] },
        'src/b.ts': { source: 'b', mutants: [] },
        'src/c.ts': { source: 'c', mutants: [] },
      },
    });
    expect(last).toEqual(cached());
  });

  it('keeps a result whose static flag is not true', () => {
    const report: Report = {
      files: { 'a.ts': { mutants: [at(1), at(2, 2, { static: false })] } },
    };
    expect(withoutStatic(report)).toEqual({ report, dropped: 0 });
  });

  it('rewrites the incremental file without the static results', () => {
    const file = write('incremental.json', JSON.stringify(cached()));
    expect(dropStatic(file)).toBe(`3 static mutants of ${file} run again.`);
    const written = readFileSync(file, 'utf8');
    expect(written.endsWith('}\n')).toBe(true);
    expect(JSON.parse(written)).toEqual(withoutStatic(cached()).report);
    expect(dropStatic(file)).toBe(`0 static mutants of ${file} run again.`);
  });

  it('does nothing without an incremental file', () => {
    const file = joinPath(dir, 'missing.json');
    expect(dropStatic(file)).toBe(`No ${file}: every mutant runs.`);
    expect(existsSync(file)).toBe(false);
  });

  it('fails on a file that is no report and leaves it as it was', () => {
    for (const [name, content] of [
      ['broken.json', '{"files": '],
      ['empty.json', ''],
      ['null.json', 'null'],
      ['nofiles.json', '{"testFiles": {}}'],
      ['nomutants.json', '{"files": {"a.ts": {"source": "x"}}}'],
      ['nullfile.json', '{"files": {"a.ts": null}}'],
    ] as const) {
      const file = write(name, content);
      expect(() => dropStatic(file)).toThrow(`${file} is no Stryker report.`);
      expect(readFileSync(file, 'utf8')).toBe(content);
    }
  });

  it('reads a report only with a list of mutants in every file', () => {
    const report = cached();
    expect(reportOf(report)).toBe(report);
    expect(reportOf({ files: {} })).toEqual({ files: {} });
    for (const wrong of [
      undefined,
      null,
      7,
      {},
      { files: null },
      { files: 'a.ts' },
      { files: { 'a.ts': {} } },
      { files: { 'a.ts': { mutants: {} } } },
      { files: { 'a.ts': 'x' } },
    ])
      expect(reportOf(wrong)).toBeUndefined();
  });
});

describe('mutation shards: the incremental run in the workflows (#201)', () => {
  const workflow = (name: string): string[] =>
    readFileSync(`.github/workflows/${name}`, 'utf8').split('\n');
  it('removes the static results right before the incremental run of a shard', () => {
    const ci = workflow('ci.yml');
    const drop = ci.indexOf('      - name: Static mutants run again');
    const run = ci.indexOf('      - name: Incremental run');
    expect(drop).toBeGreaterThan(
      ci.indexOf('      - name: Configuration of this shard'),
    );
    // Every shard of ci.yml runs incrementally: a release pull request runs
    // no mutation job since #387, so no complete run of its own is left.
    expect(ci.slice(drop, run)).toEqual([
      '      - name: Static mutants run again',
      '        run: node scripts/mutation-shards.ts drop-static',
    ]);
    expect(ci.slice(run + 1, run + 2)).toEqual([
      '        run: pnpm test:mutation reports/stryker-shard.config.json',
    ]);
    expect(ci.filter((l) => l.includes('drop-static'))).toHaveLength(1);
  });

  it('runs every other mutation run complete', () => {
    const runs = [...workflow('ci.yml'), ...workflow('mutation.yml')].filter(
      (l) => l.includes('pnpm test:mutation'),
    );
    // The partial run of a pull request (#309) has no cache and its
    // configuration switches the incremental file off (the tests of
    // scripts/mutation-partial.ts), so it tests every mutant of its files.
    expect(runs.filter((l) => !l.endsWith(' --force'))).toEqual([
      '        run: pnpm test:mutation reports/stryker-shard.config.json',
      '      - run: pnpm test:mutation reports/stryker-partial.config.json',
    ]);
    expect(workflow('mutation.yml').join('\n')).not.toContain('drop-static');
  });
});
