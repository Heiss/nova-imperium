import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  coverage,
  merge,
  mutatedFiles,
  prune,
  type Report,
  SHARDS,
  shardConfig,
  split,
  weigh,
} from '../../scripts/mutation-shards.ts';

const stryker = JSON.parse(readFileSync('stryker.config.json', 'utf8'));
const lines = (file: string) => readFileSync(file, 'utf8').split('\n').length;
const mutants = (n: number) => Array.from({ length: n }, () => ({}));
const sum = (files: string[], w: Record<string, number>) =>
  files.reduce((total, f) => total + w[f]!, 0);
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
    expect(files).toContain('src/shared/economy.ts');
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
    // Display texts are not mutated (owner, 2026-11-12); the rules are.
    expect(files).not.toContain('src/shared/texts.ts');
    expect(files).toContain('src/shared/catalog.ts');
  });

  it('weighs a file by its mutants in the last report, else by its lines', () => {
    const last: Report = {
      files: { 'a.ts': { mutants: mutants(7) }, 'b.ts': { mutants: [] } },
    };
    const length = (f: string) => ({ 'a.ts': 100, 'b.ts': 50, 'c.ts': 30 })[f]!;
    expect(weigh(['a.ts', 'b.ts', 'c.ts'], last, length)).toEqual({
      'a.ts': 7,
      'b.ts': 0,
      'c.ts': 30,
    });
    expect(weigh(['a.ts', 'c.ts'], undefined, length)).toEqual({
      'a.ts': 100,
      'c.ts': 30,
    });
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
    expect(split(reversed)).toEqual(split(w));
    expect(split(w)).toEqual([['c'], ['a', 'b'], ['m'], ['x']]);
  });

  it('leaves a shard empty when there are fewer files than shards', () => {
    expect(split({ a: 2, b: 1 })).toEqual([['a'], ['b'], [], []]);
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
