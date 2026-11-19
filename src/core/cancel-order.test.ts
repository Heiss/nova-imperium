import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEF, SHIPS, UNIT } from './catalog.ts';
import { cancelOrder } from './cancel-order.ts';
import { pay } from './economy.ts';
import { settle } from './settle.ts';
import type { Planet } from './types.ts';
import { planet, U } from '../test/fixtures.ts';

const NOW = 10_000;

/** A planet with a shipyard list that started at `sqT`. */
const yard = (sq: Planet['sq'], sqT: number | null = 0): Planet =>
  planet({ res: { m: 1000, c: 1000, d: 1000 }, sq, sqT });

const lf = SHIPS.lf!;
const rl = DEF.rl!;
const [lfCost, rlCost] = [lf.cost, rl.cost];

describe('cancelling an order of the shipyard (#258)', () => {
  it('refunds the full cost of every unit of the order, and takes it out', () => {
    const p = yard([{ key: 'lf', n: 5, unit: 100 }], NOW);
    const res = { ...p.res };
    expect(cancelOrder(p, 0, 'lf', NOW)).toEqual({ key: 'lf', n: 5 });
    expect(p.res).toEqual({
      m: res.m + 5 * lfCost[0],
      c: res.c + 5 * lfCost[1],
      d: res.d + 5 * lfCost[2],
    });
    expect(p.sq).toEqual([]);
  });

  it('refunds defense as well as ships', () => {
    const p = yard([{ key: 'rl', n: 3, unit: 100 }], NOW);
    const res = { ...p.res };
    expect(cancelOrder(p, 0, 'rl', NOW)).toEqual({ key: 'rl', n: 3 });
    expect(p.res.m).toBe(res.m + 3 * rlCost[0]);
    expect(p.res.c).toBe(res.c + 3 * rlCost[1]);
  });

  it('leaves the units that are done, and refunds only those not done yet, the one in progress included', () => {
    // Four units of 100 ms from 0: at 250 two are done (settled), the third is half way.
    const settled = settle(yard([{ key: 'lf', n: 4, unit: 100 }], 0), 250, U);
    expect(settled.ships.lf).toBe(2);
    expect(settled.sq).toEqual([{ key: 'lf', n: 2, unit: 100 }]);
    const res = { ...settled.res };
    expect(cancelOrder(settled, 0, 'lf', 250)).toEqual({ key: 'lf', n: 2 });
    expect(settled.ships.lf).toBe(2);
    expect(settled.res.m).toBe(res.m + 2 * lfCost[0]);
  });

  it('lets the next order start now when the first one is cancelled, its progress lost', () => {
    const p = yard(
      [
        { key: 'lf', n: 2, unit: 100 },
        { key: 'rl', n: 1, unit: 300 },
      ],
      NOW - 70,
    );
    cancelOrder(p, 0, 'lf', NOW);
    expect(p.sq).toEqual([{ key: 'rl', n: 1, unit: 300 }]);
    expect(p.sqT).toBe(NOW);
  });

  it('leaves the time of the running order when a later one is cancelled', () => {
    const p = yard(
      [
        { key: 'lf', n: 2, unit: 100 },
        { key: 'rl', n: 1, unit: 300 },
        { key: 'lf', n: 4, unit: 100 },
      ],
      NOW - 70,
    );
    expect(cancelOrder(p, 1, 'rl', NOW)).toEqual({ key: 'rl', n: 1 });
    expect(p.sq.map((q) => q.n)).toEqual([2, 4]);
    expect(p.sqT).toBe(NOW - 70);
    cancelOrder(p, 1, 'lf', NOW);
    expect(p.sq.map((q) => q.key)).toEqual(['lf']);
    expect(p.sqT).toBe(NOW - 70);
  });

  it('has no start time when the list is empty afterwards', () => {
    const p = yard([{ key: 'lf', n: 2, unit: 100 }], NOW - 10);
    cancelOrder(p, 0, 'lf', NOW);
    expect(p.sq).toEqual([]);
    expect(p.sqT).toBeNull();
  });

  it('changes nothing when the position holds no order or another unit', () => {
    const sq = [
      { key: 'lf', n: 2, unit: 100 },
      { key: 'rl', n: 1, unit: 300 },
    ];
    for (const [pos, key] of [
      [0, 'rl'],
      [1, 'lf'],
      [2, 'lf'],
      [5, 'rl'],
      [-1, 'lf'],
      [0.5, 'lf'],
      [Number.NaN, 'lf'],
      [0, 'nothing'],
      [0, ''],
    ] as const) {
      const p = yard(structuredClone(sq), 7);
      const before = structuredClone(p);
      expect(cancelOrder(p, pos, key, NOW), `${pos} ${key}`).toBeNull();
      expect(p).toEqual(before);
    }
    const empty = yard([], null);
    expect(cancelOrder(empty, 0, 'lf', NOW)).toBeNull();
    expect(empty.sqT).toBeNull();
  });

  it('gives back exactly what the order paid, for any unit and count', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(UNIT)),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 0, max: 2 }),
        (key, n, others) => {
          const p = planet({
            res: { m: 9_000_000, c: 9_000_000, d: 9_000_000 },
            sqT: 0,
            sq: [
              ...Array.from({ length: others }, () => ({
                key: 'lf',
                n: 1,
                unit: 10,
              })),
              { key, n, unit: 10 },
            ],
          });
          const start = { ...p.res };
          pay(p, UNIT[key]!.cost, n);
          expect(cancelOrder(p, others, key, NOW)).toEqual({ key, n });
          expect(p.res).toEqual(start);
          expect(p.sq).toHaveLength(others);
        },
      ),
      { seed: 258, numRuns: 200 },
    );
  });
});
