// Giving up a colony („Kolonie aufgeben“, #224, okf/features/abandon-colony.md).
// A player gives up an own planet that nothing refers to any more: not the
// main planet (D3), no flight, research or order of the planet or its moon
// (D1). Everything on it is lost with the moon (Q1), and the position stays
// locked for colonization for the hours the admin sets per round (D2). The
// server and the colonization ask these rules (patterns, section 7); the
// password is the server's, like every check of the session.
import type { Planet } from './types.ts';

/** One hour in milliseconds; the lock runs in real time. */
export const HOUR_MS = 3_600_000;

/** The lock of a given-up position in whole hours: the admin's range per round [V] and the owner's default. */
export const ABANDON_LOCK_HOURS = { min: 1, max: 720, default: 24 } as const;

/** Whether `hours` is a lock the admin may set for a round. */
export const isAbandonLockHours = (hours: unknown): hours is number =>
  Number.isInteger(hours) &&
  (hours as number) >= ABANDON_LOCK_HOURS.min &&
  (hours as number) <= ABANDON_LOCK_HOURS.max;

/** When the lock of a position given up at `at` ends. */
export const positionLockEnd = (at: number, hours: number): number =>
  at + hours * HOUR_MS;

/** Whether a lock that ends at `end` still holds at `now`; it is over at its end. */
export const positionLocked = (end: number | null, now: number): boolean =>
  end !== null && now < end;

/** What of a planet or moon refers to it: its orders. */
type Site = Pick<Planet, 'id' | 'bq' | 'sq'>;

/** A flight by the places it starts from and flies to, of any player. */
export interface FlightRef {
  from: string;
  to: string;
}

/** The planet a player wants to give up and what refers to it. */
export interface AbandonCheck {
  /** The planet, or null when it does not exist. */
  target: (Site & Pick<Planet, 'owner' | 'kind'>) | null;
  /** The moon of the planet, or null without one. */
  moon: Site | null;
  uid: string;
  /** The id of the player's main planet (#221). */
  main: string | null;
  /** The flights of every player. */
  flights: readonly FlightRef[];
  /** The place of the player's running research, or null without one. */
  research: string | null;
}

/** Why a planet cannot be given up. */
export type AbandonError =
  'unknown' | 'moon' | 'main' | 'flights' | 'research' | 'orders';

/** Whether a building or shipyard order runs on the place. */
const ordered = (s: Site): boolean => s.bq !== null || s.sq.length > 0;

/**
 * Why `target` itself cannot be given up, or null when it can: the own
 * planet first, a moon alone is out of scope, then the main planet (D3).
 * The overview asks this to offer the action.
 */
export function abandonTargetError(
  target: Pick<Planet, 'id' | 'owner' | 'kind'> | null,
  uid: string,
  main: string | null,
): 'unknown' | 'moon' | 'main' | null {
  if (target?.owner !== uid) return 'unknown';
  if (target.kind !== 'planet') return 'moon';
  return target.id === main ? 'main' : null;
}

/**
 * Why `target` cannot be given up now, or null when it can: the target
 * itself (`abandonTargetError`), then flights, research and orders of the
 * planet or its moon (D1).
 */
export function abandonError(c: AbandonCheck): AbandonError | null {
  const own = abandonTargetError(c.target, c.uid, c.main);
  if (own) return own;
  const target = c.target!;
  const sites = c.moon ? [target, c.moon] : [target];
  const ids = sites.map((s) => s.id);
  if (c.flights.some((f) => ids.includes(f.from) || ids.includes(f.to)))
    return 'flights';
  if (c.research !== null && ids.includes(c.research)) return 'research';
  return sites.some(ordered) ? 'orders' : null;
}
