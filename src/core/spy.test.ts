import { describe, expect, it } from 'vitest';
import {
  counterChance,
  probesFor,
  SPY_LEVELS,
  spyParts,
  spyScore,
} from './spy.ts';

describe('spy rules (#285)', () => {
  it('shows the parts in the order of the report from their Auspex-Wert', () => {
    expect(SPY_LEVELS.map(([min]) => min)).toEqual([2, 3, 5, 7]);
    expect(spyParts(1)).toEqual([]);
    expect(spyParts(2)).toEqual(['ships']);
    expect(spyParts(4)).toEqual(['ships', 'def']);
    expect(spyParts(6)).toEqual(['ships', 'def', 'b']);
    expect(spyParts(7)).toEqual(['ships', 'def', 'b', 'r']);
  });

  it('counts the lead squared, for and against', () => {
    expect(spyScore(3, 0)).toBe(3);
    expect(spyScore(3, 2)).toBe(7);
    expect(spyScore(3, -2)).toBe(-1);
  });

  it('needs the fewest Spähschädel that reach the level, at least one', () => {
    for (const diff of [-3, -2, -1, 0, 1, 2, 3])
      for (const [min] of SPY_LEVELS) {
        const n = probesFor(min, diff);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(spyScore(n, diff)).toBeGreaterThanOrEqual(min);
        if (n > 1) expect(spyScore(n - 1, diff)).toBeLessThan(min);
      }
    expect(probesFor(7, -3)).toBe(16);
    expect(probesFor(2, 3)).toBe(1);
  });

  it('shoots down with the root of the ships, halved per level of lead', () => {
    expect(counterChance(0, -5)).toBe(0);
    expect(counterChance(100, 0)).toBe(20);
    expect(counterChance(100, 1)).toBe(10);
    expect(counterChance(100, -1)).toBe(40);
    expect(counterChance(10000, 0)).toBe(100);
  });
});
