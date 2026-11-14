// Contract of the component `produces` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it, so a new producer is
// checked without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { ENTRIES } from '../../features/index.gen.ts';
import {
  BASE_INCOME,
  energyMade,
  made,
  type MineCtx,
  type Produces,
  type RateCtx,
} from './produces.ts';

const PRODUCERS = ENTRIES.flatMap(([key, e]) =>
  'produces' in e ? [[key, e.produces as Produces] as const] : [],
);
const RATES = ['e', 'm', 'c', 'd'] as const;

/** A planet as a rate function sees it: levels 0 to 60, every share, the temperatures of the game. */
const mineCtx = (level: fc.Arbitrary<number>): fc.Arbitrary<MineCtx> =>
  fc.record({
    level,
    pct: fc.integer({ min: 0, max: 100 }),
    temp: fc.integer({ min: -40, max: 160 }),
    research: fc.record({ energy: fc.integer({ min: 0, max: 30 }) }),
    u: fc.constant(U),
    f: fc.double({ min: 0, max: 1, noNaN: true }),
  });

describe('produces: contract for every entry that has it', () => {
  it('gives every producer its own place in the production order', () => {
    const orders = PRODUCERS.map(([, p]) => p.order);
    for (const o of orders) expect(Number.isFinite(o)).toBe(true);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it.each(PRODUCERS)('%s: produces energy or a resource', (_, produces) => {
    expect(RATES.some((r) => produces[r])).toBe(true);
  });

  it.each(PRODUCERS)(
    '%s: every rate is finite and never below 0, levels 0 to 60',
    (_, produces) => {
      fc.assert(
        fc.property(mineCtx(fc.integer({ min: 0, max: 60 })), (ctx) => {
          for (const r of RATES) {
            const rate = produces[r]?.(ctx) ?? 0;
            expect(Number.isFinite(rate)).toBe(true);
            expect(rate).toBeGreaterThanOrEqual(0);
          }
        }),
      );
    },
  );

  it.each(PRODUCERS)(
    '%s: nothing at level 0; the base income is the core’s',
    (_, produces) => {
      fc.assert(
        fc.property(mineCtx(fc.constant(0)), (ctx) => {
          for (const r of RATES) expect(produces[r]?.(ctx) ?? 0).toBe(0);
        }),
      );
    },
  );
});

describe('produces: the rule', () => {
  const ctx: RateCtx = { level: 2, pct: 50, temp: 20, research: {}, u: U };
  const at = (produces: Produces) => ({ produces, ctx });

  it('adds the energy of all producers, skipping the others', () => {
    expect(energyMade([])).toBe(0);
    expect(
      energyMade([
        at({ order: 1, e: (x) => x.level * 0.1 }),
        at({ order: 2, m: () => 99 }),
        at({ order: 3, e: (x) => x.pct }),
      ]),
    ).toBe(0.2 + 50);
  });

  it('adds the base income and the rates, with f, times the speed', () => {
    const list = [
      at({ order: 1, m: (x) => x.f * 10 }),
      at({ order: 2, e: () => 99, c: (x) => x.level }),
    ];
    const u = { ...U, speed: 3 };
    expect(made(list, 'm', 0.5, u)).toBe((BASE_INCOME.m + 5) * 3);
    expect(made(list, 'c', 0.5, u)).toBe((BASE_INCOME.c + 2) * 3);
    expect(made(list, 'd', 0.5, u)).toBe(0);
    expect(BASE_INCOME).toEqual({ m: 20, c: 10, d: 0 });
  });

  it('never goes below 0', () => {
    expect(made([at({ order: 1, d: () => -5 })], 'd', 1, U)).toBe(0);
  });
});
