import { describe, expect, it } from 'vitest';
import {
  LIVE_MS,
  lastSlot,
  passHolds,
  roundSettings,
} from './highscore-passes.ts';

/** A moment of 2026-11-25 on the clock of the server. */
const at = (h: number, m: number, s = 0, day = 25): number =>
  new Date(2026, 10, day, h, m, s).getTime();

describe('the passes of the highscore (#405)', () => {
  it('runs three times a day at 00:05, 08:05 and 16:05 by default', () => {
    expect(roundSettings[0]).toMatchObject({
      key: 'roundHighscorePasses',
      label: 'Highscore-Aktualisierungen pro Tag (0 = Echtzeit)',
      min: 0,
      max: 24,
      def: 3,
      live: true,
    });
    expect(lastSlot(at(8, 5), 3)).toBe(at(8, 5));
    expect(lastSlot(at(8, 4, 59), 3)).toBe(at(0, 5));
    expect(lastSlot(at(16, 5), 3)).toBe(at(16, 5));
    expect(lastSlot(at(23, 59), 3)).toBe(at(16, 5));
    // Before 00:05 the last pass of the day before.
    expect(lastSlot(at(0, 4), 3)).toBe(at(16, 5, 0, 24));
    expect(lastSlot(at(0, 5), 3)).toBe(at(0, 5));
  });

  it('spreads N passes every 24/N hours from 00:05', () => {
    expect(lastSlot(at(23, 0), 1)).toBe(at(0, 5));
    expect(lastSlot(at(13, 0), 2)).toBe(at(12, 5));
    expect(lastSlot(at(5, 6), 24)).toBe(at(5, 5));
    // 24/5 hours: 4 h 48 min.
    expect(lastSlot(at(4, 53), 5)).toBe(at(4, 53));
    expect(lastSlot(at(4, 52), 5)).toBe(at(0, 5));
  });

  it('keeps a pass until the next slot', () => {
    expect(passHolds(null, at(9, 0), 3)).toBe(false);
    expect(passHolds(at(8, 5), at(16, 4, 59), 3)).toBe(true);
    expect(passHolds(at(8, 5), at(16, 5), 3)).toBe(false);
    // A pass after a slot, made when the server started, holds until the next.
    expect(passHolds(at(9, 30), at(16, 0), 3)).toBe(true);
    expect(passHolds(at(8, 4), at(8, 5), 3)).toBe(false);
    // A pass from the future (the clock went back) does not hold.
    expect(passHolds(at(9, 0), at(8, 59), 3)).toBe(false);
  });

  it('keeps a live pass 10 s', () => {
    expect(LIVE_MS).toBe(10_000);
    const t = at(12, 0);
    expect(passHolds(t, t, 0)).toBe(true);
    expect(passHolds(t, t + 9_999, 0)).toBe(true);
    expect(passHolds(t, t + 10_000, 0)).toBe(false);
  });
});
