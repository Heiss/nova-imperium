// Trümmerfelder (#45, owner, 2026-11-13): 30 % of the Adamant and
// Psikristall of every destroyed ship of both sides, Sonnenreliquiare
// included; no Promethium, no defense.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEF, FIGHTERS, SHIPS } from './catalog.ts';
import { DEBRIS_SHARE, debrisOf, isEmpty } from './debris.ts';

describe('debris of a battle', () => {
  it('is 30 % of the Adamant and Psikristall of the destroyed ships', () => {
    expect(DEBRIS_SHARE).toBe(0.3);
    // Two Abfangjäger (3,000 / 1,000 / 0 each) of five are lost.
    expect(debrisOf([{ before: { lf: 5 }, after: { lf: 3 } }])).toEqual({
      m: 1800,
      c: 600,
    });
    // A whole Lastbarke (6,000 / 6,000 / 2,000): no Promethium.
    expect(debrisOf([{ before: { lc: 1 }, after: {} }])).toEqual({
      m: 1800,
      c: 1800,
    });
  });

  it('counts the ships of both sides', () => {
    expect(
      debrisOf([
        { before: { lf: 2 }, after: {} },
        { before: { sc: 1, cr: 1 }, after: { cr: 1 } },
      ]),
    ).toEqual({ m: 0.3 * (6000 + 2000), c: 0.3 * (2000 + 2000) });
  });

  it('counts Sonnenreliquiare and Spähschädel, which are ships', () => {
    expect(
      debrisOf([{ before: { sat: 10, probe: 2 }, after: { sat: 4 } }]),
    ).toEqual({ m: 0, c: 0.3 * (6 * 2000 + 2 * 1000) });
  });

  it('leaves nothing of destroyed defense', () => {
    expect(
      debrisOf([{ before: { rl: 100, gauss: 3, lsd: 1 }, after: {} }]),
    ).toEqual({ m: 0, c: 0 });
    expect(
      debrisOf([{ before: { rl: 100, lf: 1 }, after: { lf: 0 } }]),
    ).toEqual({ m: 900, c: 300 });
  });

  it('leaves nothing of ships that survive, unknown keys or inherited names', () => {
    expect(debrisOf([])).toEqual({ m: 0, c: 0 });
    expect(debrisOf([{ before: { bs: 3 }, after: { bs: 3 } }])).toEqual({
      m: 0,
      c: 0,
    });
    expect(
      debrisOf([
        { before: { nope: 5, constructor: 1, toString: 2 }, after: {} },
      ]),
    ).toEqual({ m: 0, c: 0 });
  });

  it('is the share of the cost of every lost ship on generated battles', () => {
    const keys = [...Object.keys(SHIPS), ...Object.keys(DEF)];
    const side = fc
      .dictionary(
        fc.constantFrom(...keys),
        fc.tuple(
          fc.integer({ min: 0, max: 99 }),
          fc.integer({ min: 0, max: 99 }),
        ),
      )
      .map((units) => ({
        before: Object.fromEntries(
          Object.entries(units).map(([k, [a, b]]) => [k, Math.max(a, b)]),
        ),
        after: Object.fromEntries(
          Object.entries(units).map(([k, [a, b]]) => [k, Math.min(a, b)]),
        ),
      }));
    fc.assert(
      fc.property(fc.array(side, { maxLength: 3 }), (sides) => {
        let m = 0;
        let c = 0;
        for (const { before, after } of sides)
          for (const k of Object.keys(before))
            if (FIGHTERS[k]!.kind === 'ship') {
              const lost = before[k]! - after[k]!;
              m += FIGHTERS[k]!.unit.cost[0] * lost;
              c += FIGHTERS[k]!.unit.cost[1] * lost;
            }
        expect(debrisOf(sides)).toEqual({ m: m * 0.3, c: c * 0.3 });
      }),
      { seed: 45, numRuns: 300 },
    );
  });
});

describe('an empty field', () => {
  it('holds neither Adamant nor Psikristall', () => {
    expect(isEmpty({ m: 0, c: 0 })).toBe(true);
    expect(isEmpty({ m: 0.1, c: 0 })).toBe(false);
    expect(isEmpty({ m: 0, c: 0.1 })).toBe(false);
    expect(isEmpty({ m: -1, c: 0 })).toBe(true);
  });
});
