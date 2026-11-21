// The hints of the check for control by an AI or a program (#181; owner,
// 2026-11-14 and 2026-11-21; coordinator Q37 to Q39 [V]). Only for the
// admin, only raw facts: no score, no threshold, no verdict. They are worked
// out from what the server keeps anyway (the game actions of the audit log,
// the hits of the action limit of #328, the intervals of active play time of
// #231) and only for the time since the check was switched on, never from
// earlier data, and at most for the last 30 days (the retention of the audit
// log; the play time is kept longer, so the days are cut here).
import type { Interval } from './playtime.ts';

const DAY_MS = 86400000;

/** How far back the hints reach: the 30 days of the audit log (owner, 2026-11-21, D4). */
export const HINT_DAYS = 30;

/** The action of the audit entry of a hit of the action limit (#328). */
export const LIMIT_ACTION = 'rateLimit';

/** A game action of the audit log: its time and its name. */
export interface Action {
  time: number;
  action: string;
}

/**
 * The gaps between two successive actions of a day, in seconds: the
 * shortest, the median, and the middle half (half of the gaps lie between
 * `lower` and `upper`, a quarter below and a quarter above).
 */
export interface Gaps {
  shortest: number;
  lower: number;
  median: number;
  upper: number;
}

/** The facts of one UTC day with actions. */
export interface BotDay {
  /** The start of the UTC day. */
  day: number;
  /** The game actions of the day (the hits of the limit not counted). */
  actions: number;
  /** Of them, the actions in no interval of active play time. */
  outsidePlay: number;
  /** The hits of the action limit (the audit notes at most one an hour). */
  limitHits: number;
  /** The gaps of the day; null with fewer than two actions. */
  gaps: Gaps | null;
}

/** The first moment the hints may read: the switch-on, at most 30 days back. */
export const hintsFrom = (since: number, now: number): number =>
  Math.max(since, now - HINT_DAYS * DAY_MS);

const seconds = (ms: number): number => Math.round(ms / 100) / 10;

/** The value at the share `p` of the sorted list (the nearest rank). */
const rank = (sorted: readonly number[], p: number): number =>
  sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;

/** The gaps of the sorted times of one day, or null with fewer than two. */
export function gapsOf(times: readonly number[]): Gaps | null {
  if (times.length < 2) return null;
  const gaps = times
    .slice(1)
    .map((t, i) => t - times[i]!)
    .sort((a, b) => a - b);
  return {
    shortest: seconds(gaps[0]!),
    lower: seconds(rank(gaps, 0.25)),
    median: seconds(rank(gaps, 0.5)),
    upper: seconds(rank(gaps, 0.75)),
  };
}

const playing = (t: number, intervals: readonly Interval[]): boolean =>
  intervals.some((i) => i.start <= t && t <= i.end);

/**
 * The days with actions since the check was switched on (`since`), newest
 * first. `actions` are the game actions of the player from the audit log,
 * `intervals` the player's intervals of active play time; anything before
 * `hintsFrom(since, now)` or after `now` is left out.
 */
export function botHints(
  actions: readonly Action[],
  intervals: readonly Interval[],
  since: number,
  now: number,
): BotDay[] {
  const from = hintsFrom(since, now);
  const days = new Map<
    number,
    { times: number[]; outside: number; hits: number }
  >();
  for (const a of actions) {
    if (a.time < from || a.time > now) continue;
    const day = a.time - (a.time % DAY_MS);
    const d = days.get(day) ?? { times: [], outside: 0, hits: 0 };
    days.set(day, d);
    if (a.action === LIMIT_ACTION) {
      d.hits++;
      continue;
    }
    d.times.push(a.time);
    if (!playing(a.time, intervals)) d.outside++;
  }
  return [...days]
    .sort(([a], [b]) => b - a)
    .map(([day, d]) => ({
      day,
      actions: d.times.length,
      outsidePlay: d.outside,
      limitHits: d.hits,
      gaps: gapsOf([...d.times].sort((a, b) => a - b)),
    }));
}
