// The stable plan of the mutation shards and the weights it uses (owner,
// 2026-11-13, #141): every entry stays on its shard, new ones go onto the
// lightest, only a shard above tolerance gives entries away; every run
// takes the times of the mutants it ran, the others keep their old time.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  join,
  type Mutant,
  type Report,
  reweigh,
  settle,
  shardOf,
  SHARDS,
  slim,
  split,
  stateOf,
  TOLERANCE,
} from '../../scripts/mutation-shards.ts';

const at = (
  line: number,
  extra: Partial<Mutant> = {},
  mutatorName = 'StringLiteral',
): Mutant => ({
  location: { start: { line, column: 2 }, end: { line, column: 9 } },
  mutatorName,
  replacement: '""',
  ...extra,
});
const loads = (plan: string[][], w: Record<string, number>) =>
  plan.map((units) => units.reduce((t, u) => t + w[u]!, 0));
const total = (w: Record<string, number>) =>
  Object.values(w).reduce((t, x) => t + x, 0);

describe('mutation shards: the shard an entry had', () => {
  const previous = [['a.ts', 'cat.ts:1-40'], ['cat.ts:41-90'], ['b.ts']];

  it('finds a whole file, and a piece by the range that holds its first line', () => {
    expect(shardOf(previous, 'a.ts')).toBe(0);
    expect(shardOf(previous, 'b.ts')).toBe(2);
    expect(shardOf(previous, 'cat.ts:1-12')).toBe(0);
    expect(shardOf(previous, 'cat.ts:40-55')).toBe(0);
    expect(shardOf(previous, 'cat.ts:41-41')).toBe(1);
    expect(shardOf(previous, 'cat.ts:90-99')).toBe(1);
    // the first range that holds the line, wherever it is in the plan
    expect(shardOf([['cat.ts:41-90'], ['cat.ts:1-40']], 'cat.ts:1-12')).toBe(1);
    // a cut file that is whole again: the shard of its first line
    expect(shardOf(previous, 'cat.ts')).toBe(0);
    // a whole file that is cut now: all its pieces on its shard
    expect(shardOf(previous, 'b.ts:30-60')).toBe(2);
  });

  it('knows no new file and no line the ranges do not hold', () => {
    expect(shardOf(previous, 'new.ts')).toBeUndefined();
    expect(shardOf(previous, 'cat.ts:91-120')).toBeUndefined();
    expect(shardOf(previous, 'a.t')).toBeUndefined();
    expect(shardOf([], 'a.ts')).toBeUndefined();
  });
});

describe('mutation shards: the stable plan', () => {
  const previous = [['a', 'b'], ['c'], ['d', 'e']];

  it('keeps every entry on its shard while every shard is within tolerance', () => {
    // mean 10, limit 15: the shards weigh 14, 6 and 10
    const w = { a: 9, b: 5, c: 6, d: 4, e: 6 };
    expect(settle(w, previous, 3)).toEqual({
      plan: previous,
      load: [14, 6, 10],
      moved: [],
      added: [],
    });
    // the greedy split would have moved them
    expect(split(w, 3)).not.toEqual(previous);
  });

  it('puts new entries onto the lightest shard, heaviest first', () => {
    const w = { a: 9, b: 5, c: 6, d: 4, e: 6, n1: 2, n2: 3, n3: 3 };
    const settled = settle(w, previous, 3);
    // the shards weigh 14, 6 and 10: c takes n2 (3, before n3 by name) and
    // n3 (9 is still the lightest), then d and e take n1
    expect(settled.added).toEqual(['n2', 'n3', 'n1']);
    expect(settled.plan).toEqual([
      ['a', 'b'],
      ['c', 'n2', 'n3'],
      ['d', 'e', 'n1'],
    ]);
    expect(settled.moved).toEqual([]);
  });

  it('moves the lightest entry that brings a shard within tolerance alone', () => {
    // mean 10, limit 15: the first shard weighs 20, 5 too much
    const w = { a: 3, b: 6, f: 11, c: 4, d: 3, e: 3 };
    const settled = settle(w, [['a', 'b', 'f'], ['c'], ['d', 'e']], 3);
    expect(settled.moved).toEqual(['b']);
    expect(settled.plan).toEqual([
      ['a', 'f'],
      ['b', 'c'],
      ['d', 'e'],
    ]);
    expect(settled.load).toEqual([14, 10, 6]);
  });

  it('else moves the heaviest entry that fits, and again until within', () => {
    // mean 10, limit 15: 27 is 12 too much and no entry weighs 12, so the
    // heaviest (e, after d by name) goes to the empty shard; 20 is 5 too
    // much, c (5) brings it to 15 and goes to the then lightest shard (3)
    const w = { a: 4, b: 4, c: 5, d: 7, e: 7, f: 3 };
    const settled = settle(w, [['a', 'b', 'c', 'd', 'e'], [], ['f']], 3);
    expect(settled.moved).toEqual(['e', 'c']);
    expect(settled.plan).toEqual([['a', 'b', 'd'], ['e'], ['c', 'f']]);
    expect(settled.load).toEqual([15, 7, 8]);
  });

  it('moves an entry that fills the lightest shard exactly to the limit', () => {
    // mean 5, limit 5: a (5) brings the first shard within it and fits
    expect(settle({ a: 5, b: 5 }, [['a', 'b'], []], 2, 1)).toEqual({
      plan: [['b'], ['a']],
      load: [5, 5],
      moved: ['a'],
      added: [],
    });
  });

  it('chooses by weight, equal weights by name, not by the order of the shard', () => {
    // mean 7, limit 7: 13 is 6 too much; of the entries that fit into the
    // room of 3, none weighs 6, so the heaviest goes: b, after a by name;
    // then 10 is 3 too much and a (3) brings it within, c (1) does not
    const w = { a: 3, b: 3, c: 1, d: 6, e: 4, f: 4 };
    const settled = settle(w, [['a', 'b', 'c', 'd'], ['e'], ['f']], 3, 1);
    expect(settled.moved).toEqual(['b', 'a']);
    expect(settled.plan).toEqual([
      ['c', 'd'],
      ['b', 'e'],
      ['a', 'f'],
    ]);
  });

  it('leaves an entry that fits nowhere, and moves no entry without weight', () => {
    const w = { big: 50, z: 0, a: 1, b: 1 };
    const settled = settle(w, [['big', 'z'], ['a'], ['b']], 3);
    expect(settled.moved).toEqual([]);
    expect(settled.plan).toEqual([['big', 'z'], ['a'], ['b']]);
  });

  it('splits greedily without a previous plan of as many shards', () => {
    const w = { a: 1, b: 5, c: 4, d: 3, e: 3, f: 2, g: 2 };
    expect(settle(w, undefined, 3).plan).toEqual(split(w, 3));
    expect(settle(w, [['a'], ['b']], 3)).toEqual(settle(w, undefined, 3));
    expect(settle(w, undefined, 3).added).toEqual([
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'a',
    ]);
    // equal weights by name, whatever the order of the weights
    expect(settle({ g: 2, f: 2, e: 3, d: 3 }, undefined, 2).added).toEqual([
      'd',
      'e',
      'f',
      'g',
    ]);
  });

  it('keeps the pieces of a file on its shard; the join makes it whole again', () => {
    const w = { 'cat.ts:1-9': 4, 'cat.ts:10-20': 4, 'x.ts': 4 };
    const settled = settle(w, [['x.ts'], ['cat.ts']], 2, 10);
    expect(join(settled.plan)).toEqual([['x.ts'], ['cat.ts']]);
  });

  it('uses 6 shards and a tolerance of 1.5 times the mean by default', () => {
    expect(TOLERANCE).toBe(1.5);
    const w = { a: 10, b: 10, c: 10, d: 10, e: 10, f: 10 };
    const previous6 = [['a', 'b'], ['c'], ['d'], ['e'], ['f'], []];
    // 20 is 2 times the mean of 10: a goes to the empty shard
    expect(settle(w, previous6).moved).toEqual(['a']);
    const within = { ...w, a: 5, b: 5 };
    // 10 is 1.2 times the mean of 50 / 6
    expect(settle(within, previous6).moved).toEqual([]);
    expect(settle(w, previous6).plan).toHaveLength(SHARDS);
  });
});

// Units u0 … un with integer weights, a previous plan that knows some of
// them, the shards and the tolerance.
const input = fc
  .record({
    shards: fc.integer({ min: 1, max: 7 }),
    weights: fc.array(fc.integer({ min: 0, max: 100 }), {
      minLength: 0,
      maxLength: 40,
    }),
    tolerance: fc.constantFrom(1, 1.25, 1.5, 2),
    seat: fc.array(fc.integer({ min: -1, max: 6 }), { maxLength: 40 }),
  })
  .map(({ shards, weights, tolerance, seat }) => {
    const w = Object.fromEntries(weights.map((x, i) => [`u${i}`, x]));
    const previous: string[][] = Array.from({ length: shards }, () => []);
    Object.keys(w).forEach((u, i) => {
      const s = seat[i] ?? -1;
      if (s >= 0 && s < shards) previous[s]!.push(u);
    });
    return { w, previous, shards, tolerance };
  });

describe('mutation shards: properties of the stable plan', () => {
  it('assigns every entry exactly once, each shard sorted', () => {
    fc.assert(
      fc.property(input, ({ w, previous, shards, tolerance }) => {
        const { plan, load } = settle(w, previous, shards, tolerance);
        expect(plan).toHaveLength(shards);
        expect(plan.flat().sort()).toEqual(Object.keys(w).sort());
        for (const units of plan) expect(units).toEqual([...units].sort());
        expect(load).toEqual(loads(plan, w));
      }),
    );
  });

  it('gives the same plan for the same input, in any order of the weights', () => {
    fc.assert(
      fc.property(input, ({ w, previous, shards, tolerance }) => {
        const reversed = Object.fromEntries(Object.entries(w).reverse());
        const shuffled = previous.map((units) => [...units].reverse());
        expect(settle(reversed, shuffled, shards, tolerance)).toEqual(
          settle(w, previous, shards, tolerance),
        );
      }),
    );
  });

  it('moves no entry while every shard is within tolerance', () => {
    fc.assert(
      fc.property(input, ({ w, previous, shards, tolerance }) => {
        const known = Object.fromEntries(
          previous.flat().map((u) => [u, w[u]!]),
        );
        const limit = (total(known) / shards) * tolerance;
        fc.pre(loads(previous, known).every((l) => l <= limit));
        const settled = settle(known, previous, shards, tolerance);
        expect(settled.moved).toEqual([]);
        expect(settled.added).toEqual([]);
        expect(settled.plan).toEqual(previous.map((u) => [...u].sort()));
      }),
    );
  });

  it('moves entries only off shards above tolerance, onto shards that stay within', () => {
    fc.assert(
      fc.property(input, ({ w, previous, shards, tolerance }) => {
        const known = Object.fromEntries(
          previous.flat().map((u) => [u, w[u]!]),
        );
        const limit = (total(known) / shards) * tolerance;
        const before = loads(previous, known);
        const settled = settle(known, previous, shards, tolerance);
        for (const unit of settled.moved) {
          expect(before[shardOf(previous, unit)!]!).toBeGreaterThan(limit);
          expect(known[unit]!).toBeGreaterThan(0);
        }
        settled.plan.forEach((units, s) => {
          const kept = previous[s]!.filter((u) => units.includes(u));
          if (before[s]! <= limit) expect(kept).toEqual(previous[s]);
          // a shard that got entries ends within tolerance
          if (units.some((u) => !previous[s]!.includes(u)))
            expect(settled.load[s]!).toBeLessThanOrEqual(limit + 1e-9);
        });
      }),
    );
  });

  it('brings every shard within tolerance unless no entry of it fits elsewhere', () => {
    fc.assert(
      fc.property(input, ({ w, previous, shards, tolerance }) => {
        const settled = settle(w, previous, shards, tolerance);
        const limit = (total(w) / shards) * tolerance;
        const room = limit - Math.min(...settled.load);
        settled.plan.forEach((units, s) => {
          if (settled.load[s]! > limit + 1e-9)
            for (const u of units)
              expect(w[u] === 0 || w[u]! > room + 1e-9).toBe(true);
        });
      }),
    );
  });

  it('puts a new entry onto the lightest shard', () => {
    fc.assert(
      fc.property(
        input,
        fc.integer({ min: 0, max: 100 }),
        ({ w, previous, shards }, weight) => {
          const known = Object.fromEntries(
            previous.flat().map((u) => [u, w[u]!]),
          );
          const before = loads(previous, known);
          const lightest = before.indexOf(Math.min(...before));
          // no tolerance, so nothing else moves
          const settled = settle(
            { ...known, new: weight },
            previous,
            shards,
            Infinity,
          );
          expect(settled.added).toEqual(['new']);
          expect(settled.plan[lightest]).toContain('new');
        },
      ),
    );
  });
});

describe('mutation shards: the weights after a run', () => {
  it('keeps place, kind and time of each mutant only', () => {
    const report: Report = {
      schemaVersion: '1.0',
      files: {
        'a.ts': {
          source: 'const a = "x";',
          mutants: [
            {
              ...at(1, { duration: 12, static: true }),
              id: '7',
              status: 'Killed',
              coveredBy: ['1'],
            },
          ],
        },
      },
    };
    expect(slim(report)).toStrictEqual({
      files: { 'a.ts': { mutants: [at(1, { duration: 12, static: true })] } },
    });
    expect(slim(undefined)).toEqual({ files: {} });
  });

  it('takes the time of every mutant the run ran; the others keep their old one', () => {
    const old: Report = {
      files: {
        'a.ts': { mutants: [at(1, { duration: 10 }), at(2, { duration: 20 })] },
        'gone.ts': { mutants: [at(1, { duration: 5 })] },
      },
    };
    const run: Report = {
      files: {
        'a.ts': {
          mutants: [
            { ...at(1, { duration: 99 }), status: 'Killed' },
            // taken over by Stryker: no time in the report
            { ...at(2), status: 'Killed' },
            // new, not run (no coverage): no time anywhere
            { ...at(3), status: 'NoCoverage' },
          ],
        },
        'new.ts': { mutants: [at(1, { duration: 4 })] },
      },
    };
    expect(reweigh(old, run)).toEqual({
      files: {
        'a.ts': {
          mutants: [at(1, { duration: 99 }), at(2, { duration: 20 }), at(3)],
        },
        'new.ts': { mutants: [at(1, { duration: 4 })] },
      },
    });
    expect(reweigh(undefined, run).files['a.ts']!.mutants[1]).toEqual(at(2));
  });

  it('finds the old time of a mutant whose lines moved by its kind, in order', () => {
    const old: Report = {
      files: {
        'a.ts': {
          mutants: [
            at(1, { duration: 1 }),
            at(2, { duration: 2 }),
            at(3, { duration: 3, static: true }),
            at(4, { duration: 4 }, 'BooleanLiteral'),
          ],
        },
      },
    };
    // ten lines inserted at the top, and a new mutant at the end that ran
    const run: Report = {
      files: {
        'a.ts': {
          mutants: [
            at(11),
            at(12),
            at(13, { static: true }),
            at(14, {}, 'BooleanLiteral'),
            at(20, { duration: 50 }),
          ],
        },
      },
    };
    expect(reweigh(old, run).files['a.ts']!.mutants).toEqual([
      at(11, { duration: 1 }),
      at(12, { duration: 2 }),
      at(13, { duration: 3, static: true }),
      at(14, { duration: 4 }, 'BooleanLiteral'),
      at(20, { duration: 50 }),
    ]);
    // a mutant that ran takes the place of the next old one of its kind
    const first: Report = {
      files: { 'a.ts': { mutants: [at(10, { duration: 70 }), at(11)] } },
    };
    expect(reweigh(old, first).files['a.ts']!.mutants).toEqual([
      at(10, { duration: 70 }),
      at(11, { duration: 2 }),
    ]);
  });

  it('matches a moved mutant only with an old one of the same mutator and kind', () => {
    const old: Report = {
      files: {
        'a.ts': {
          mutants: [
            at(1, { duration: 4 }, 'BooleanLiteral'),
            at(2, { duration: 1 }),
            at(3, { duration: 30, static: true }),
            at(4, { duration: 2, static: false }),
          ],
        },
      },
    };
    const run: Report = {
      files: {
        'a.ts': {
          mutants: [
            at(11),
            at(12, {}, 'BooleanLiteral'),
            at(13),
            at(14, { static: true }),
          ],
        },
      },
    };
    expect(reweigh(old, run).files['a.ts']!.mutants).toStrictEqual([
      at(11, { duration: 1 }),
      at(12, { duration: 4 }, 'BooleanLiteral'),
      // static: false and no static are the same kind
      at(13, { duration: 2 }),
      at(14, { duration: 30, static: true }),
    ]);
  });

  it('keeps a time for each mutant the run took over (property)', () => {
    const mutant = fc.record({
      line: fc.integer({ min: 1, max: 30 }),
      ran: fc.boolean(),
      now: fc.integer({ min: 0, max: 1000 }),
      before: fc.integer({ min: 0, max: 1000 }),
    });
    fc.assert(
      fc.property(fc.uniqueArray(mutant, { selector: (m) => m.line }), (ms) => {
        const old: Report = {
          files: {
            'a.ts': {
              mutants: ms.map((m) => at(m.line, { duration: m.before })),
            },
          },
        };
        const run: Report = {
          files: {
            'a.ts': {
              mutants: ms.map((m) =>
                at(m.line, m.ran ? { duration: m.now } : {}),
              ),
            },
          },
        };
        const weights = reweigh(old, run).files['a.ts']!.mutants;
        expect(weights.map((m) => m.duration)).toEqual(
          ms.map((m) => (m.ran ? m.now : m.before)),
        );
      }),
    );
  });
});

describe('mutation shards: the state between runs', () => {
  it('accepts a plan with weights and refuses anything else', () => {
    const state = { plan: [['a.ts'], []], weights: { files: {} } };
    expect(stateOf(state)).toBe(state);
    for (const wrong of [
      undefined,
      null,
      {},
      { plan: [['a.ts']] },
      { plan: 'a.ts', weights: { files: {} } },
      { plan: [['a.ts', 3]], weights: { files: {} } },
      { plan: ['a.ts'], weights: { files: {} } },
      { plan: [['a.ts'], 'b.ts'], weights: { files: {} } },
      { plan: [['a.ts']], weights: { files: null } },
      { plan: [['a.ts']], weights: {} },
    ])
      expect(stateOf(wrong)).toBeUndefined();
  });
});
