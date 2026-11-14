// Contract of the component `consumes` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { ENTRIES } from '../../features/index.gen.ts';
import { type Consumes, energyUsed, left } from './consumes.ts';
import type { RateCtx } from './produces.ts';

const CONSUMERS = ENTRIES.flatMap(([key, e]) =>
  'consumes' in e ? [[key, e.consumes as Consumes, e] as const] : [],
);
const RATES = ['e', 'm', 'c', 'd'] as const;

const rateCtx = (level: fc.Arbitrary<number>): fc.Arbitrary<RateCtx> =>
  fc.record({
    level,
    pct: fc.integer({ min: 0, max: 100 }),
    temp: fc.integer({ min: -40, max: 160 }),
    research: fc.record({ energy: fc.integer({ min: 0, max: 30 }) }),
    u: fc.integer({ min: 1, max: 10 }).map((speed) => ({ ...U, speed })),
  });

describe('consumes: contract for every entry that has it', () => {
  it.each(CONSUMERS)(
    '%s: also produces, so it has a place in the production order',
    (_, consumes, entry) => {
      expect('produces' in entry).toBe(true);
      expect(RATES.some((r) => consumes[r])).toBe(true);
    },
  );

  it.each(CONSUMERS)(
    '%s: every use is finite and never below 0, levels 0 to 60',
    (_, consumes) => {
      fc.assert(
        fc.property(rateCtx(fc.integer({ min: 0, max: 60 })), (ctx) => {
          for (const r of RATES) {
            const rate = consumes[r]?.(ctx) ?? 0;
            expect(Number.isFinite(rate)).toBe(true);
            expect(rate).toBeGreaterThanOrEqual(0);
          }
        }),
      );
    },
  );

  it('uses a stock in one entry at most: how several consumers share an empty stock is not decided (#115)', () => {
    const stocks = CONSUMERS.flatMap(([key, consumes]) =>
      (['m', 'c', 'd'] as const).filter((r) => consumes[r]).map((r) => key + r),
    );
    expect(stocks.length).toBeLessThanOrEqual(1);
  });

  it.each(CONSUMERS)('%s: uses nothing at level 0', (_, consumes) => {
    fc.assert(
      fc.property(rateCtx(fc.constant(0)), (ctx) => {
        for (const r of RATES) expect(consumes[r]?.(ctx) ?? 0).toBe(0);
      }),
    );
  });
});

describe('consumes: the rule', () => {
  const ctx: RateCtx = { level: 2, pct: 50, temp: 20, research: {}, u: U };

  it('adds the energy of all consumers, skipping the others', () => {
    expect(energyUsed([])).toBe(0);
    expect(
      energyUsed([
        { consumes: { e: (x) => x.level }, ctx },
        { ctx },
        { consumes: { d: () => 9 }, ctx },
        { consumes: { e: (x) => x.pct }, ctx },
      ]),
    ).toBe(52);
  });

  it('subtracts every use of the resource from what was made', () => {
    const list = [
      { consumes: { d: (x: RateCtx) => x.level, e: () => 7 }, ctx },
      { ctx },
      { consumes: { d: () => 0.5, m: () => 3 }, ctx },
    ];
    expect(left(10, list, 'd')).toBe(7.5);
    expect(left(10, list, 'm')).toBe(7);
    expect(left(10, list, 'c')).toBe(10);
  });
});
