// The lab lock and the shipyard lock read the component `locks` since #183
// and name no catalog key. They must behave bit for bit as before: this test
// holds the rules as they were (with the keys named) and compares them with
// the current ones for every key of the catalog, a few names that are no key
// and inherited names, on generated planets, queues and research. The cases
// that matter are also built by hand, so the sample cannot lose them.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import { hasLab, labUpgrading, waitsForLab } from './lab.ts';
import type { Planet, ResearchState } from './types.ts';
import {
  hasYard,
  waitsForYard,
  YARD_HOME,
  YARD_LOCK,
  yardLockedBy,
} from './yard.ts';

// ----- frozen: core/lab.ts and core/yard.ts before #183 -----

const OLD_YARD_LOCK: Readonly<Record<string, string>> = {
  yard: 'Schiffsschmiede',
  nanite: 'Machina-Schwarmhalle',
};
const oldLocks = (key: string): boolean => Object.hasOwn(OLD_YARD_LOCK, key);
const old = {
  hasYard: (p: Pick<Planet, 'b'>): boolean => (p.b.yard ?? 0) > 0,
  yardLockedBy: (p: Pick<Planet, 'bq'>): string | null =>
    p.bq && oldLocks(p.bq.key) ? p.bq.key : null,
  waitsForYard: (p: Pick<Planet, 'sq'>, key: string): boolean =>
    oldLocks(key) && p.sq.length > 0,
  hasLab: (p: Pick<Planet, 'b'>): boolean => (p.b.lab ?? 0) > 0,
  labUpgrading: (p: Pick<Planet, 'bq'>): boolean => p.bq?.key === 'lab',
  waitsForLab: (r: Pick<ResearchState, 'rq'>, key: string): boolean =>
    key === 'lab' && !!r.rq,
};

// ----- the cases -----

const KEYS = [
  ...Object.keys(BUILD),
  ...Object.keys(RES),
  ...Object.keys(SHIPS),
  ...Object.keys(DEF),
  '',
  'nothing',
  'toString',
  'constructor',
  '__proto__',
  'hasOwnProperty',
];

const order = { key: 'lf', n: 1, unit: 1 };
const cost = [0, 0, 0] as [number, number, number];

const planet = fc.record({
  b: fc.dictionary(
    fc.constantFrom(...KEYS.filter((k) => k !== '__proto__')),
    fc.integer({ min: 0, max: 5 }),
  ),
  bq: fc.option(
    fc.record({
      key: fc.constantFrom(...KEYS),
      lvl: fc.integer({ min: 1, max: 5 }),
      start: fc.constant(0),
      end: fc.constant(9),
      cost: fc.constant(cost),
    }),
    { nil: null },
  ),
  sq: fc.array(fc.constant(order), { maxLength: 2 }),
});

const research = fc.record({
  rq: fc.option(
    fc.record({
      key: fc.constantFrom(...KEYS),
      lvl: fc.integer({ min: 1, max: 5 }),
      start: fc.constant(0),
      end: fc.constant(9),
      cost: fc.constant(cost),
    }),
    { nil: null },
  ),
});

type Sample = { b: Planet['b']; bq: Planet['bq']; sq: Planet['sq'] };

/** Every rule on one planet and one research, for one key. */
const asked = (
  fns: typeof old,
  p: Sample,
  r: Pick<ResearchState, 'rq'>,
  key: string,
) => ({
  hasYard: fns.hasYard(p),
  yardLockedBy: fns.yardLockedBy(p),
  waitsForYard: fns.waitsForYard(p, key),
  hasLab: fns.hasLab(p),
  labUpgrading: fns.labUpgrading(p),
  waitsForLab: fns.waitsForLab(r, key),
});

const current: typeof old = {
  hasYard,
  yardLockedBy,
  waitsForYard,
  hasLab,
  labUpgrading,
  waitsForLab,
};

describe('the locks against the rules before #183', () => {
  it('names the same buildings and the same short names', () => {
    expect(YARD_LOCK).toEqual(OLD_YARD_LOCK);
    expect(Object.keys(YARD_LOCK).sort()).toEqual(['nanite', 'yard']);
    expect(YARD_HOME).toBe('yard');
  });

  it('answers every rule as before, for every key, on generated planets', () => {
    fc.assert(
      fc.property(planet, research, fc.constantFrom(...KEYS), (p, r, key) => {
        expect(asked(current, p, r, key)).toEqual(asked(old, p, r, key));
      }),
      { seed: 183, numRuns: 300 },
    );
  });

  it('answers as before in the cases by hand, for every key', () => {
    const upgrade = (key: string): Sample['bq'] => ({
      key,
      lvl: 1,
      start: 0,
      end: 9,
      cost,
    });
    const running = { rq: { key: 'energy', lvl: 1, start: 0, end: 9, cost } };
    const planets: Sample[] = [
      { b: {}, bq: null, sq: [] },
      { b: { yard: 1 }, bq: null, sq: [order] },
      { b: { lab: 1 }, bq: upgrade('lab'), sq: [] },
      { b: { yard: 2 }, bq: upgrade('yard'), sq: [] },
      { b: { yard: 2, nanite: 1 }, bq: upgrade('nanite'), sq: [order, order] },
      { b: { yard: 0, lab: 0 }, bq: upgrade('robot'), sq: [order] },
      { b: { yard: 1, lab: 1 }, bq: upgrade('toString'), sq: [] },
    ];
    for (const p of planets)
      for (const r of [{ rq: null }, running])
        for (const key of KEYS)
          expect(asked(current, p, r, key), `${key}`).toEqual(
            asked(old, p, r, key),
          );
    // The lock of the lab, and only the lab, as before.
    expect(current.labUpgrading(planets[2]!)).toBe(true);
    expect(current.labUpgrading(planets[3]!)).toBe(false);
    expect(current.yardLockedBy(planets[4]!)).toBe('nanite');
    expect(current.waitsForLab(running, 'lab')).toBe(true);
    expect(current.waitsForYard(planets[1]!, 'nanite')).toBe(true);
  });
});
