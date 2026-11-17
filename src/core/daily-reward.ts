// The daily reward of #220 (owner, 2026-11-16, „Geklärt“): the median
// hourly production of all players times the minutes of the day of the
// round. Pure functions; the server collects the production.
import type { Cost } from './types.ts';

const DAY = 86_400_000;

/** From this day of the round on, the reward is 90 minutes of production. */
const LAST_RISING_DAY = 30;

/**
 * The day of the round at `now`, from 1 (#220). It changes at 00:00 UTC,
 * like the streak and the claim; a time before the start counts as day 1.
 */
export function roundDay(start: number, now: number): number {
  return Math.max(1, Math.floor(now / DAY) - Math.floor(start / DAY) + 1);
}

/**
 * The minutes of production that day `day` (from 1) of the round gives:
 * round(30 + 60 · ln(d) / ln(30)) up to day 30, then 90 (owner, #220;
 * rounding to the nearest whole minute is [V]).
 */
export function rewardMinutes(day: number): number {
  const d = Math.min(day, LAST_RISING_DAY);
  return Math.round(30 + (60 * Math.log(d)) / Math.log(LAST_RISING_DAY));
}

/** The median; of an even count the mean of the two middle values, of none 0. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The hourly production of one planet or moon and its owner. */
export interface PlanetOutput {
  owner: string;
  m: number;
  c: number;
  d: number;
}

/** Per player the sum of the hourly production of all their planets, for each resource. */
export function playerOutputs(planets: readonly PlanetOutput[]): Cost[] {
  const sums = new Map<string, Cost>();
  for (const p of planets) {
    const [m, c, d] = sums.get(p.owner) ?? [0, 0, 0];
    sums.set(p.owner, [m + p.m, c + p.c, d + p.d]);
  }
  return [...sums.values()];
}

/** The median of the players' hourly production, for each resource. */
export function medianOutput(players: readonly Cost[]): Cost {
  return [
    median(players.map((p) => p[0])),
    median(players.map((p) => p[1])),
    median(players.map((p) => p[2])),
  ];
}

/**
 * The reward of day `day` of the round: the median hourly production times
 * its minutes, in whole resources rounded down and never below 0 ([V]).
 * No cap: it is credited above the storage too (owner, #220 D5).
 */
export function dailyReward(output: Cost, day: number): Cost {
  const minutes = rewardMinutes(day);
  const share = (perHour: number): number =>
    Math.max(0, Math.floor((perHour * minutes) / 60));
  return [share(output[0]), share(output[1]), share(output[2])];
}
