// The loot and the rebuilt defense (#288): the numbers the Lexicanum reads and
// the rules the server uses, since the move out of `server/game/fight.ts`.
import { describe, expect, it } from 'vitest';
import {
  cutLoot,
  LOOT_SHARE,
  plunder,
  REBUILD_DRAWN_BELOW,
  REBUILD_SHARE,
  rebuild,
} from './loot.ts';

describe('the numbers of the loot and the rebuilt defense', () => {
  it('has the classic shares and the border of the drawn rebuilding', () => {
    expect(LOOT_SHARE).toBe(0.5);
    expect(REBUILD_SHARE).toBe(0.7);
    expect(REBUILD_DRAWN_BELOW).toBe(50);
  });

  it('draws every piece below the border and rounds the share above it', () => {
    expect(rebuild(0, () => 0)).toBe(0);
    expect(rebuild(-3, () => 0)).toBe(0);
    // A piece is rebuilt when the draw is below the share.
    expect(rebuild(10, () => 0.69)).toBe(10);
    expect(rebuild(10, () => 0.7)).toBe(0);
    expect(rebuild(REBUILD_DRAWN_BELOW - 1, () => 0.1)).toBe(49);
    // From the border on the share is rounded and no draw is asked.
    const never = (): number => {
      throw new Error('no draw');
    };
    expect(rebuild(REBUILD_DRAWN_BELOW, never)).toBe(35);
    expect(rebuild(100, never)).toBe(70);
    expect(rebuild(51, never)).toBe(36);
  });

  it('takes the share of the stock as far as the holds reach, and shares fill in a fixed order', () => {
    const stock = { m: 1000, c: 600, d: 200 };
    expect(plunder(stock, 1e9)).toEqual({ m: 500, c: 300, d: 100 });
    expect(plunder(stock, 1e9, 1)).toEqual(stock);
    expect(plunder(stock, 0)).toEqual({ m: 0, c: 0, d: 0 });
    expect(cutLoot({ m: 500, c: 300, d: 100 }, 300)).toEqual({
      m: 100,
      c: 100,
      d: 100,
    });
  });
});
