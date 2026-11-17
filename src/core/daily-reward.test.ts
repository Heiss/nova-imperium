// The daily reward of #220: the minutes of the day of the round, the median
// of all players' hourly production and the reward from both.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  dailyReward,
  median,
  medianOutput,
  playerOutputs,
  rewardMinutes,
  roundDay,
} from './daily-reward.ts';
import type { Cost } from './types.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 10, 16, 21, 37);

describe('the day of the round', () => {
  it('is 1 on the day the round starts and changes at 00:00 UTC', () => {
    expect(roundDay(START, START)).toBe(1);
    const midnight = Date.UTC(2026, 10, 17);
    expect(roundDay(START, midnight - 1)).toBe(1);
    expect(roundDay(START, midnight)).toBe(2);
    expect(roundDay(START, midnight + 28 * DAY)).toBe(30);
    expect(roundDay(START, midnight + 400 * DAY)).toBe(402);
  });

  it('counts a time before the start as day 1', () => {
    expect(roundDay(START, START - 2 * DAY)).toBe(1);
    expect(roundDay(START, 1_000_000)).toBe(1);
  });

  it('rises by one with every UTC day (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4e12 }),
        fc.integer({ min: 0, max: DAY - 1 }),
        fc.integer({ min: 0, max: 2000 }),
        (start, offset, days) => {
          const day0 = Math.floor(start / DAY) * DAY;
          expect(roundDay(start, day0 + days * DAY + offset)).toBe(days + 1);
        },
      ),
    );
  });
});

describe('the minutes of the day of the round', () => {
  it('follows round(30 + 60 · ln(d) / ln(30)) up to day 30, then 90', () => {
    expect(rewardMinutes(1)).toBe(30);
    expect(rewardMinutes(2)).toBe(42);
    expect(rewardMinutes(3)).toBe(49);
    expect(rewardMinutes(4)).toBe(54);
    expect(rewardMinutes(5)).toBe(58);
    // 61.608 rounds to the nearest minute ([V]).
    expect(rewardMinutes(6)).toBe(62);
    expect(rewardMinutes(7)).toBe(64);
    expect(rewardMinutes(29)).toBe(89);
    expect(rewardMinutes(30)).toBe(90);
    expect(rewardMinutes(31)).toBe(90);
    expect(rewardMinutes(365)).toBe(90);
  });

  it('rises from 30 to 90, steep at first and then flatter (property)', () => {
    const all = Array.from({ length: 40 }, (_, i) => rewardMinutes(i + 1));
    for (const [i, m] of all.entries()) {
      expect(Number.isInteger(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(i === 0 ? 30 : all[i - 1]!);
      expect(m).toBeLessThanOrEqual(90);
    }
    expect(all[1]! - all[0]!).toBeGreaterThan(all[29]! - all[28]!);
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 1e6 }), (d) => {
        expect(rewardMinutes(d)).toBe(90);
      }),
    );
  });
});

describe('the median', () => {
  it('takes the middle value, of an even count the mean of the two middle ones', () => {
    expect(median([])).toBe(0);
    expect(median([7])).toBe(7);
    expect(median([9, 1, 5])).toBe(5);
    expect(median([10, 2, 3, 1])).toBe(2.5);
    expect(median([4, -6])).toBe(-1);
    expect(median([300, 100, 200, 100, 5000])).toBe(200);
  });

  it('does not change its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('lies between the values and halves them (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1e6, max: 1e6 }), { minLength: 1 }),
        (values) => {
          const m = median(values);
          const sorted = [...values].sort((a, b) => a - b);
          expect(m).toBeGreaterThanOrEqual(sorted[0]!);
          expect(m).toBeLessThanOrEqual(sorted.at(-1)!);
          expect(values.filter((v) => v < m).length * 2).toBeLessThanOrEqual(
            values.length,
          );
          expect(values.filter((v) => v > m).length * 2).toBeLessThanOrEqual(
            values.length,
          );
          // The order of the players does not matter.
          expect(median([...values].reverse())).toBe(m);
        },
      ),
    );
  });
});

describe('the production of the players', () => {
  it('sums all planets of a player for each resource', () => {
    expect(playerOutputs([])).toEqual([]);
    expect(
      playerOutputs([
        { owner: 'a', m: 100, c: 50, d: 0 },
        { owner: 'b', m: 30, c: 20, d: 10 },
        { owner: 'a', m: 25.5, c: 5, d: -4 },
      ]),
    ).toEqual([
      [125.5, 55, -4],
      [30, 20, 10],
    ]);
  });

  it('takes the median of the players for each resource', () => {
    expect(medianOutput([])).toEqual([0, 0, 0]);
    expect(
      medianOutput([
        [100, 10, 0],
        [300, 50, 9],
        [200, 30, 1],
      ]),
    ).toEqual([200, 30, 1]);
    // Each resource on its own: the median player differs per resource.
    expect(
      medianOutput([
        [1, 60, 5],
        [2, 40, 7],
        [3, 50, 1],
        [4, 70, 3],
      ]),
    ).toEqual([2.5, 55, 4]);
  });

  it('keeps the sum of all production (property)', () => {
    const planet = fc.record({
      owner: fc.constantFrom('a', 'b', 'c', 'd'),
      m: fc.integer({ min: 0, max: 1e6 }),
      c: fc.integer({ min: 0, max: 1e6 }),
      d: fc.integer({ min: -1e5, max: 1e6 }),
    });
    fc.assert(
      fc.property(fc.array(planet), (planets) => {
        const players = playerOutputs(planets);
        expect(players).toHaveLength(new Set(planets.map((p) => p.owner)).size);
        const total = (i: 0 | 1 | 2): number =>
          players.reduce((s, p) => s + p[i], 0);
        expect(total(0)).toBe(planets.reduce((s, p) => s + p.m, 0));
        expect(total(1)).toBe(planets.reduce((s, p) => s + p.c, 0));
        expect(total(2)).toBe(planets.reduce((s, p) => s + p.d, 0));
      }),
    );
  });
});

describe('the daily reward', () => {
  it('is the median production times the minutes of the day, rounded down', () => {
    const output: Cost = [100, 50, 7];
    expect(dailyReward(output, 1)).toEqual([50, 25, 3]);
    expect(dailyReward(output, 2)).toEqual([70, 35, 4]);
    expect(dailyReward(output, 7)).toEqual([106, 53, 7]);
    expect(dailyReward(output, 30)).toEqual([150, 75, 10]);
    expect(dailyReward(output, 31)).toEqual([150, 75, 10]);
    expect(dailyReward([4000, 2400, 1200], 4)).toEqual([3600, 2160, 1080]);
  });

  it('is never negative', () => {
    expect(dailyReward([-120, 0, -1], 30)).toEqual([0, 0, 0]);
    expect(dailyReward([0.5, 60, -0.1], 1)).toEqual([0, 30, 0]);
  });

  it('grows with the day and the production and has no cap (property)', () => {
    const rate = fc.integer({ min: 0, max: 1e7 });
    fc.assert(
      fc.property(
        fc.tuple(rate, rate, rate),
        fc.integer({ min: 1, max: 60 }),
        (output, day) => {
          const today = dailyReward(output, day);
          const tomorrow = dailyReward(output, day + 1);
          const minutes = rewardMinutes(day);
          for (const i of [0, 1, 2] as const) {
            expect(tomorrow[i]).toBeGreaterThanOrEqual(today[i]);
            expect(today[i]).toBe(Math.floor((output[i] * minutes) / 60));
          }
        },
      ),
    );
  });
});
