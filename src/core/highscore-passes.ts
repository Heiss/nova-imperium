// How often the points and the highscore are computed (#405, owner,
// 2026-11-25): N passes a day, every 24/N hours, as the classic game up to
// 0.78b did at 00:05, 08:05 and 16:05 (owiki „Punkte“); 0 is live, but one
// pass at most every 10 s, for the weak hardware the game runs on. Every
// reader between two passes takes the stored one. The slots are UTC, the
// same whatever the time zone of the server (owner, 2026-11-26, 149e): the
// first of a UTC day is at 23:05 UTC of the day before, so three passes are
// at 00:05, 08:05 and 16:05 in German winter time, an hour later in summer.
import type { RoundSetting } from './round.ts';

const DAY_MS = 86_400_000;
/** The first pass of a UTC day: 23:05 UTC of the day before (149e). */
const ANCHOR_MS = (23 * 60 + 5) * 60_000;
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
  // How Wirtschaft and Militär count (#422, owner, 2026-11-26, 166a, 167a):
  // by number or by the resources spent, each on its own, Anzahl by default.
  {
    kind: 'number',
    key: 'roundHighscoreEconomy',
    name: 'highscoreEconomy',
    label: 'Wirtschaft zählt nach',
    order: 490,
    min: 0,
    max: 1,
    def: 0,
    choices: [
      { value: 0, label: 'Anzahl' },
      { value: 1, label: 'Rohstoffen' },
    ],
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
    choices: [
      { value: 0, label: 'Anzahl' },
      { value: 1, label: 'Rohstoffen' },
    ],
    live: true,
  },
] as const satisfies readonly RoundSetting[];

/** How Wirtschaft and Militär count: by number (Anzahl, the default) or by resources (#422). */
export const COUNT_BY = { count: 0, resources: 1 } as const;

/**
 * The time of the last scheduled pass at or before `now`: 23:05 UTC, then
 * every 24/N hours; before 23:05 UTC the passes from 23:05 UTC of the day
 * before count. Arithmetic on UTC milliseconds only, no local clock.
 */
export function lastSlot(now: number, perDay: number): number {
  const start = Math.floor((now - ANCHOR_MS) / DAY_MS) * DAY_MS + ANCHOR_MS;
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
