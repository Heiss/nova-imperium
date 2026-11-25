// How often the points and the highscore are computed (#405, owner,
// 2026-11-25): N passes a day, every 24/N hours from 00:05 server time, as
// the classic game up to 0.78b did at 00:05, 08:05 and 16:05 (owiki
// „Punkte“); 0 is live, but one pass at most every 10 s, for the weak
// hardware the game runs on. Every reader between two passes takes the
// stored one.
import type { RoundSetting } from './round.ts';

const DAY_MS = 86_400_000;
/** The first pass of a day: 00:05 server time. */
const FIRST_MINUTE = 5;
/** „Echtzeit“ (0): one pass at most every 10 s, not one per call. */
export const LIVE_MS = 10_000;

const HIGHSCORE_PASSES = { min: 0, max: 24, def: 3 } as const;

/**
 * [V] The heading of the section in „Neue Runde“: the name of the view
 * „Highscore“; the owner gave the label of the field only.
 */
export const roundHeading = 'Highscore';

export const roundSettings = [
  {
    kind: 'number',
    key: 'roundHighscorePasses',
    name: 'highscorePasses',
    label: 'Highscore-Aktualisierungen pro Tag (0 = Echtzeit)',
    order: 480,
    min: HIGHSCORE_PASSES.min,
    max: HIGHSCORE_PASSES.max,
    def: HIGHSCORE_PASSES.def,
    live: true,
  },
] as const satisfies readonly RoundSetting[];

/**
 * The time of the last scheduled pass at or before `now`: 00:05 of the day
 * on the clock of the server, then every 24/N hours. Before 00:05 the
 * passes of the day before count.
 */
export function lastSlot(now: number, perDay: number): number {
  const first = new Date(now);
  first.setHours(0, FIRST_MINUTE, 0, 0);
  if (first.getTime() > now) first.setDate(first.getDate() - 1);
  const start = first.getTime();
  const every = DAY_MS / perDay;
  return start + Math.floor((now - start) / every) * every;
}

/** Whether a pass made at `at` still holds at `now` (null: none yet). */
export function passHolds(
  at: number | null,
  now: number,
  perDay: number,
): boolean {
  if (at === null || at > now) return false;
  return perDay === 0 ? now - at < LIVE_MS : at >= lastSlot(now, perDay);
}
