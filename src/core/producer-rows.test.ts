// The rows of the resources page come from the core (#114, owner,
// 2026-11-14): producerRows() uses the same list, energy factor `f` and
// throttled share as production(), so its rows add up to prod() of the
// planet as it runs, bit for bit where prod() adds in the same order. The
// browser computes no production formula. Also the generic displays of the
// shipyard (energy of one piece) and of the buildings (use per hour at the
// next level).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { PRODUCERS } from './catalog.ts';
import {
  fusionEnergy,
  fusionUse,
  pieceEnergy,
  prod,
  producerRows,
  type ProducerRow,
  throttle,
  useAt,
} from './economy.ts';
import type { Levels, Planet, Universe } from './types.ts';

const g = (l: number): number => l * Math.pow(1.1, l);

/** The planet as production() runs it: the reactor at its throttled share. */
function asRuns(p: Planet, u: Universe, r: Levels): Planet {
  const share = throttle(p, u, r)?.share;
  return share === undefined ? p : { ...p, pct: { ...p.pct, fusion: share } };
}

type Column = 'm' | 'c' | 'd' | 'e';
/** The rows of `column` added up in the production order, as prod() does. */
const sum = (
  rows: readonly ProducerRow[],
  side: 'made' | 'used',
  column: Column,
  start = 0,
): number =>
  rows.reduce((s, row) => {
    const x = row[side][column];
    return x === undefined ? s : s + x;
  }, start);

const level = fc.integer({ min: 0, max: 40 });
const share = fc.oneof(
  fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
  fc.double({ min: 0, max: 100, noNaN: true }),
);
const planets = fc
  .record({
    b: fc.record(
      {
        metal: level,
        crystal: level,
        deut: level,
        solar: level,
        fusion: level,
      },
      { requiredKeys: [] },
    ),
    sat: fc.integer({ min: 0, max: 3000 }),
    pct: fc.record(Object.fromEntries(PRODUCERS.map((k) => [k, share])), {
      requiredKeys: [],
    }),
    temp: fc.integer({ min: -60, max: 180 }),
    d: fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 100000 })),
  })
  .map(({ b, sat, pct, temp, d }) =>
    planet({
      b: b as Levels,
      ships: { sat },
      pct: pct as Levels,
      temp,
      res: { m: 0, c: 0, d },
    }),
  );
const universes = fc
  .oneof(
    fc.constant(1),
    fc.integer({ min: 1, max: 100 }),
    fc.double({ min: 0.5, max: 10, noNaN: true }),
  )
  .map((speed) => ({ ...U, speed }));
const research = fc.record(
  { energy: fc.integer({ min: 0, max: 20 }) },
  { requiredKeys: [] },
);

describe('producerRows() (#114)', () => {
  it('adds up to prod() of the planet as it runs', () => {
    fc.assert(
      fc.property(planets, universes, research, (p, u, r) => {
        const { f, base, rows } = producerRows(p, u, r);
        const pr = prod(asRuns(p, u, r), u, r);
        expect(Object.is(f, pr.f)).toBe(true);
        expect(Object.is(sum(rows, 'made', 'e'), pr.eProd)).toBe(true);
        expect(Object.is(sum(rows, 'used', 'e'), pr.eUse)).toBe(true);
        for (const res of ['m', 'c', 'd'] as const) {
          const net =
            sum(rows, 'made', res, base[res]) - sum(rows, 'used', res);
          // prod() multiplies the sum with the speed, the rows each rate.
          if (u.speed === 1) expect(Object.is(net, pr[res]), res).toBe(true);
          else expect(net).toBeCloseTo(pr[res], 6);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('has one row per producer with its level or number and share', () => {
    fc.assert(
      fc.property(planets, universes, research, (p, u, r) => {
        const runs = asRuns(p, u, r);
        const { rows } = producerRows(p, u, r);
        expect(rows.map((x) => x.key)).toEqual(PRODUCERS);
        for (const row of rows) {
          const have = row.kind === 'ship' ? p.ships : p.b;
          expect(row.level, row.key).toBe(have[row.key] ?? 0);
          expect(row.pct, row.key).toBe(runs.pct[row.key] ?? 100);
          expect(row.throttled, row.key).toBe(
            row.pct !== (p.pct[row.key] ?? 100),
          );
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('gives what each entry makes and uses, the resources times the speed', () => {
    const u = { ...U, speed: 3 };
    const p = planet({
      b: { metal: 10, crystal: 4, deut: 6, solar: 5, fusion: 2 },
      ships: { sat: 3 },
      pct: { crystal: 50 },
      temp: 8,
      res: { m: 0, c: 0, d: 1000 },
    });
    const { f, base, rows } = producerRows(p, u, { energy: 3 });
    const by = Object.fromEntries(rows.map((x) => [x.key, x]));
    expect(base).toEqual({ m: 60, c: 30, d: 0 });
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
    expect(by.metal!.made).toEqual({ m: 30 * g(10) * f * 3 });
    expect(by.metal!.used).toEqual({ e: 10 * g(10) });
    expect(by.crystal!.made).toEqual({ c: 20 * g(4) * 0.5 * f * 3 });
    expect(by.crystal!.used).toEqual({ e: 10 * g(4) * 0.5 });
    expect(Object.keys(by.deut!.made)).toEqual(['d']);
    expect(by.deut!.used).toEqual({ e: 20 * g(6) });
    expect(by.solar!.made).toEqual({ e: 20 * g(5) });
    expect(by.solar!.used).toEqual({});
    expect(by.sat!).toMatchObject({ kind: 'ship', level: 3, pct: 100 });
    expect(by.sat!.made).toEqual({ e: 66 });
    expect(by.fusion!.made).toEqual({ e: fusionEnergy(2, 3) });
    expect(by.fusion!.used).toEqual({ d: fusionUse(2, u) });
    expect(by.metal).toMatchObject({ kind: 'building', level: 10 });
    expect(rows.some((x) => x.throttled)).toBe(false);
  });

  it('shows the reactor at its throttled share on an empty stock (#47 D1)', () => {
    const p = planet({
      b: { deut: 5, fusion: 8 },
      temp: 20,
      res: { m: 0, c: 0, d: 0 },
      pct: {},
    });
    const r = { energy: 3 };
    const share = throttle(p, U, r)!.share;
    expect(share).toBeGreaterThan(50);
    expect(share).toBeLessThan(100);
    const fusion = producerRows(p, U, r).rows.at(-1)!;
    expect(fusion).toMatchObject({
      key: 'fusion',
      pct: share,
      throttled: true,
    });
    expect(fusion.used.d).toBe(fusionUse(8, U) * (share / 100));
    const full = producerRows({ ...p, res: { m: 0, c: 0, d: 1 } }, U, r);
    expect(full.rows.at(-1)).toMatchObject({ pct: 100, throttled: false });
  });
});

describe('useAt() (#114)', () => {
  const p = planet({ b: { fusion: 2, metal: 3 }, pct: { fusion: 50 } });

  it('gives the resource use per hour at a level and the set share', () => {
    expect(useAt('fusion', 1, planet(), U)).toEqual({ d: fusionUse(1, U) });
    expect(useAt('fusion', 3, p, U)).toEqual({ d: fusionUse(3, U) * 0.5 });
    expect(useAt('fusion', 0, p, U)).toEqual({ d: 0 });
  });

  it('gives nothing for energy, a producer that uses none or no producer', () => {
    expect(useAt('metal', 4, p, U)).toEqual({});
    expect(useAt('solar', 4, p, U)).toEqual({});
    expect(useAt('lab', 4, p, U)).toEqual({});
    expect(useAt('toString', 4, p, U)).toEqual({});
  });
});

describe('pieceEnergy() (#114)', () => {
  it('gives the energy of one piece of a ship that makes energy', () => {
    expect(pieceEnergy('sat', { temp: 8 }, U)).toBe(22);
    expect(pieceEnergy('sat', { temp: 120 }, U, { energy: 5 })).toBe(50);
    expect(pieceEnergy('sat', { temp: -80 }, U)).toBe(0);
  });

  it('gives nothing for another ship, a building or no entry', () => {
    expect(pieceEnergy('lf', { temp: 8 }, U)).toBeUndefined();
    expect(pieceEnergy('solar', { temp: 8 }, U)).toBeUndefined();
    expect(pieceEnergy('fusion', { temp: 8 }, U)).toBeUndefined();
    expect(pieceEnergy('nope', { temp: 8 }, U)).toBeUndefined();
  });
});
