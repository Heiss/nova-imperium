// Which units count to Wirtschaft and which to Militär (#422, 160a), by
// number and by their costs; the pass (server/game/scores.ts) sums them.
import { describe, expect, it } from 'vitest';
import {
  addUnits,
  type CategoryTally,
  isEconomyUnit,
} from './highscore-categories.ts';

const empty = (): CategoryTally => ({
  economy: { count: 0, value: 0 },
  military: { count: 0, value: 0 },
});

describe('the units of Wirtschaft and Militär (#422)', () => {
  it('counts only the Sonnenreliquiar, the ship that does not fly, to Wirtschaft', () => {
    expect(isEconomyUnit('sat')).toBe(true);
    for (const key of ['lf', 'probe', 'dstar', 'rl', 'ipm', 'abm', 'xx'])
      expect(isEconomyUnit(key), key).toBe(false);
  });

  it('adds each unit once and its costs to its category, and skips an unknown key', () => {
    const t = empty();
    // sat 2,500; lf 4,000; rl 2,000; ipm 25,000
    addUnits(t, { sat: 2, lf: 3, rl: 1, ipm: 1, xx: 9 });
    expect(t).toEqual({
      economy: { count: 2, value: 5000 },
      military: { count: 5, value: 12_000 + 2000 + 25_000 },
    });
    addUnits(t, { lf: 1 });
    expect(t.military).toEqual({ count: 6, value: 43_000 });
    expect(t.economy).toEqual({ count: 2, value: 5000 });
  });
});
