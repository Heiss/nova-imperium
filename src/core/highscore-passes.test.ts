import { describe, expect, it } from 'vitest';
import { withoutExplain } from '../test/explain.ts';
import {
  LIVE_MS,
  lastSlot,
  passHolds,
  roundSettings,
} from './highscore-passes.ts';

/** A moment in UTC, of 2026-11-25 unless another day of the month is given. */
const at = (h: number, m: number, s = 0, day = 25, month = 10): number =>
  Date.UTC(2026, month, day, h, m, s);

describe('the passes of the highscore (#405)', () => {
  it('runs three times a day at 23:05, 07:05 and 15:05 UTC by default (149e)', () => {
    expect(roundSettings[0]).toMatchObject({
      key: 'roundHighscorePasses',
      label: 'Highscore-Aktualisierungen pro Tag (0 = Echtzeit)',
      min: 0,
      max: 24,
      def: 3,
      live: true,
    });
    expect(lastSlot(at(7, 5), 3)).toBe(at(7, 5));
    expect(lastSlot(at(7, 4, 59), 3)).toBe(at(23, 5, 0, 24));
    expect(lastSlot(at(15, 5), 3)).toBe(at(15, 5));
    expect(lastSlot(at(23, 4, 59), 3)).toBe(at(15, 5));
    // From 23:05 UTC the first pass of the next UTC day.
    expect(lastSlot(at(23, 5), 3)).toBe(at(23, 5));
    expect(lastSlot(at(23, 59), 3)).toBe(at(23, 5));
    expect(lastSlot(at(0, 4), 3)).toBe(at(23, 5, 0, 24));
  });

  it('spreads N passes every 24/N hours from 23:05 UTC', () => {
    // Once a day: at 23:05 UTC.
    expect(lastSlot(at(23, 4, 59), 1)).toBe(at(23, 5, 0, 24));
    expect(lastSlot(at(23, 5), 1)).toBe(at(23, 5));
    expect(lastSlot(at(12, 0), 1)).toBe(at(23, 5, 0, 24));
    expect(lastSlot(at(13, 0), 2)).toBe(at(11, 5));
    // Every hour at minute 5.
    expect(lastSlot(at(5, 6), 24)).toBe(at(5, 5));
    expect(lastSlot(at(5, 4, 59), 24)).toBe(at(4, 5));
    expect(lastSlot(at(23, 5), 24)).toBe(at(23, 5));
    expect(lastSlot(at(23, 4, 59), 24)).toBe(at(22, 5));
    // 24/5 hours: 4 h 48 min after 23:05 UTC is 03:53 UTC.
    expect(lastSlot(at(3, 53), 5)).toBe(at(3, 53));
    expect(lastSlot(at(3, 52), 5)).toBe(at(23, 5, 0, 24));
  });

  it('gives the same UTC slots on the days the clocks change in Europe', () => {
    // 2026-03-29 and 2026-10-25: summer time begins and ends.
    for (const [day, month] of [
      [29, 2],
      [25, 9],
    ] as const) {
      const on = (h: number, m: number) => at(h, m, 0, day, month);
      expect(lastSlot(on(7, 5), 3)).toBe(on(7, 5));
      expect(lastSlot(on(15, 4), 3)).toBe(on(7, 5));
      expect(lastSlot(on(15, 5), 3)).toBe(on(15, 5));
      expect(lastSlot(on(23, 5), 3)).toBe(on(23, 5));
      expect(lastSlot(on(2, 30), 24)).toBe(on(2, 5));
      expect(lastSlot(on(1, 0), 3)).toBe(at(23, 5, 0, day - 1, month));
    }
  });

  it('keeps a pass until the next slot', () => {
    expect(passHolds(null, at(9, 0), 3)).toBe(false);
    expect(passHolds(at(7, 5), at(15, 4, 59), 3)).toBe(true);
    expect(passHolds(at(7, 5), at(15, 5), 3)).toBe(false);
    // A pass after a slot, made when the server started, holds until the next.
    expect(passHolds(at(9, 30), at(15, 0), 3)).toBe(true);
    expect(passHolds(at(7, 4), at(7, 5), 3)).toBe(false);
    // A pass from the future (the clock went back) does not hold.
    expect(passHolds(at(9, 0), at(8, 59), 3)).toBe(false);
  });

  it('has the settings of Wirtschaft and Militär, by number by default (#422, 166a, 167a)', () => {
    const choices = [
      { value: 0, label: 'Anzahl' },
      { value: 1, label: 'Rohstoffen' },
    ];
    expect(withoutExplain(roundSettings.slice(2))).toEqual([
      {
        kind: 'number',
        key: 'roundHighscoreEconomy',
        name: 'highscoreEconomy',
        label: 'Wirtschaft zählt nach',
        order: 490,
        min: 0,
        max: 1,
        def: 0,
        choices,
        live: true,
      },
      {
        kind: 'number',
        key: 'roundHighscoreMilitary',
        name: 'highscoreMilitary',
        label: 'Militär zählt nach',
        order: 500,
        min: 0,
        max: 1,
        def: 0,
        choices,
        live: true,
      },
    ]);
  });

  it('has the setting „Highscore zeigt“, every category by default (#422, 175a, 181a)', () => {
    expect(withoutExplain(roundSettings[1])).toEqual({
      kind: 'number',
      key: 'roundHighscoreShows',
      name: 'highscoreShows',
      label: 'Highscore zeigt',
      order: 485,
      min: 0,
      max: 2,
      def: 0,
      choices: [
        { value: 0, label: 'alle Wertungen' },
        { value: 1, label: 'nur Gesamt' },
        { value: 2, label: 'nichts' },
      ],
      live: true,
    });
  });

  it('keeps a live pass 10 s', () => {
    expect(LIVE_MS).toBe(10_000);
    const t = at(12, 0);
    expect(passHolds(t, t, 0)).toBe(true);
    expect(passHolds(t, t + 9_999, 0)).toBe(true);
    expect(passHolds(t, t + 10_000, 0)).toBe(false);
    // No pass yet holds nothing, also live within 10 s of the clock's zero.
    expect(passHolds(null, 5_000, 0)).toBe(false);
  });
});
