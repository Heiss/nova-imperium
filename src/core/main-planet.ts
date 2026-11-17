// The main planet („Hauptplanet“, #221, okf/features/main-planet.md): the
// own planet a player chose in the options; without a choice the first
// planet („Heimatplanet“). It decides navigation and research only (owner,
// 2026-11-16, D1). Every switch starts a lock whose length the admin sets
// per round, 7 days by default (D3 to D5); a chosen planet that is no
// longer the player's falls back to the oldest planet left, without a lock
// (D6). The server and the options view both ask these rules (patterns,
// section 7).
import type { RoundSetting } from './round.ts';
import type { Planet } from './types.ts';

/** One day in milliseconds; the lock runs in real time. */
export const DAY_MS = 86_400_000;

/** The lock after a switch, in whole days: the admin's range per round [V] and the owner's default. */
export const MAIN_LOCK_DAYS = { min: 1, max: 30, default: 7 } as const;

/**
 * The lock as a setting of the round (#283): a number field of the dialog
 * „Neue Runde“ only; existing universes lock for the default 7 days.
 */
export const MAIN_LOCK_SETTING = {
  kind: 'number',
  key: 'roundMainLock',
  name: 'mainLock',
  label: 'Sperre nach einem Wechsel des Hauptplaneten (Tage)',
  min: MAIN_LOCK_DAYS.min,
  max: MAIN_LOCK_DAYS.max,
  def: MAIN_LOCK_DAYS.default,
  refusal: `Bitte für die Sperre des Hauptplaneten ${MAIN_LOCK_DAYS.min} bis ${MAIN_LOCK_DAYS.max} ganze Tage angeben.`,
} as const satisfies RoundSetting;

/** Whether `p` can be the main planet of `uid`: an own planet, never a moon. */
export const canBeMain = (
  p: Pick<Planet, 'owner' | 'kind'> | null | undefined,
  uid: string,
): boolean => !!p && p.owner === uid && p.kind === 'planet';

/**
 * When the lock of the last switch at `switched` ends; null without a
 * switch. The first switch and a switch back to the first planet start it
 * too (D4, D5).
 */
export const mainLockEnd = (
  switched: number | null,
  days: number,
): number | null => (switched === null ? null : switched + days * DAY_MS);

/** Whether a lock that ends at `end` still holds at `now`; it is over at its end. */
export const mainLocked = (end: number | null, now: number): boolean =>
  end !== null && now < end;

/** The main planet of a player and the end of its lock. */
export interface Main<P> {
  planet: P | null;
  lockEnd: number | null;
}

/**
 * The main planet of `uid`: the chosen planet with the lock of the last
 * switch while it can be the main planet; otherwise the oldest planet the
 * player still has, without a lock (D6). Without a choice that is the
 * first planet (owner, 2026-11-15).
 */
export function mainOf<P extends Pick<Planet, 'owner' | 'kind'>>(
  chosen: P | null | undefined,
  uid: string,
  lock: { switched: number | null; days: number },
  oldest: () => P | null,
): Main<P> {
  if (!canBeMain(chosen, uid)) return { planet: oldest(), lockEnd: null };
  return { planet: chosen!, lockEnd: mainLockEnd(lock.switched, lock.days) };
}

/** Why a planet cannot become the main planet. */
export type MainPlanetError = 'unknown' | 'moon' | 'same' | 'locked';

/** The planet chosen in the options and the player's state of the choice. */
export interface MainSwitch {
  /** The chosen place, or null when it does not exist. */
  target: Pick<Planet, 'id' | 'owner' | 'kind'> | null;
  uid: string;
  /** The id of the current main planet. */
  current: string | null;
  /** The end of the lock of the last switch, null without one. */
  lockEnd: number | null;
  now: number;
}

/** Why `target` cannot become the main planet now, or null when it can. */
export function mainSwitchError(s: MainSwitch): MainPlanetError | null {
  const { target } = s;
  if (target?.owner !== s.uid) return 'unknown';
  if (!canBeMain(target, s.uid)) return 'moon';
  if (target.id === s.current) return 'same';
  return mainLocked(s.lockEnd, s.now) ? 'locked' : null;
}
