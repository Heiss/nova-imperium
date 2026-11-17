// The vacation mode („Urlaubsmodus“, #223, okf/features/vacation-mode.md):
// a player pauses the account in the options. Entry only when nothing runs
// (owner, 2026-11-16, Q1); during it the production pauses, the player takes
// no game action and every planet and moon is protected from new missions
// of other players (Q2, D2); it ends with „Urlaubsmodus beenden“ once the
// minimum duration of the round is over (D1; owner, 2026-11-17), or with a
// new round (D3). The server, the settlement and the options view ask these
// rules (patterns, section 7). `vacationProtects` is the one protection
// check of a target: holding, the attack union, missiles and the moon
// destruction (#55, #225, #54, #95) ask it too once they are built.
import type { Planet } from './types.ts';

/** One hour in milliseconds; the minimum duration runs in real time. */
export const HOUR_MS = 3_600_000;

/** The minimum duration in whole hours: the admin's range per round [V] and the owner's default (D1). */
export const VACATION_HOURS = { min: 1, max: 720, default: 24 } as const;

/** Whether `hours` is a minimum duration the admin may set for a round. */
export const isVacationHours = (hours: unknown): hours is number =>
  Number.isInteger(hours) &&
  (hours as number) >= VACATION_HOURS.min &&
  (hours as number) <= VACATION_HOURS.max;

/** When a vacation that started at `start` can end at the earliest. */
export const vacationEnd = (start: number, hours: number): number =>
  start + hours * HOUR_MS;

/** What of the player still runs when the vacation should start (Q1). */
export interface VacationEntry {
  /** The own fleets in flight, out or back; the gift of the Endzeit not counted. */
  fleets: number;
  /** Whether a building order runs on an own planet or moon. */
  building: boolean;
  /** Whether a research runs. */
  research: boolean;
  /** Whether a shipyard order waits or runs on an own planet or moon. */
  shipyard: boolean;
}

/** Why the vacation cannot start: what still runs. */
export type VacationEntryError =
  'fleets' | 'building' | 'research' | 'shipyard';

/** Why the vacation cannot start now, or null when it can (Q1). */
export function vacationEntryError(
  e: VacationEntry,
): VacationEntryError | null {
  if (e.fleets > 0) return 'fleets';
  if (e.building) return 'building';
  if (e.research) return 'research';
  return e.shipyard ? 'shipyard' : null;
}

/** Why the vacation cannot end: there is none, or the minimum duration still runs. */
export type VacationExitError = 'inactive' | 'early';

/** Why the vacation started at `start` cannot end at `now`, or null when it can. */
export function vacationExitError(
  start: number | null,
  hours: number,
  now: number,
): VacationExitError | null {
  if (start === null) return 'inactive';
  return now < vacationEnd(start, hours) ? 'early' : null;
}

/**
 * Whether the place `target` is protected from a new action of `actor`: it
 * belongs to another player who is in vacation mode (D2, Q2). A free
 * position is never protected, nor are the own places.
 */
export const vacationProtects = (
  target: Pick<Planet, 'owner'> | null | undefined,
  actor: string,
  inVacation: (uid: string) => boolean,
): boolean => !!target && target.owner !== actor && inVacation(target.owner);

/**
 * The actions a player in vacation mode may still take [V]: the options and
 * the messages, the end of the vacation and the admin's actions. Every
 * other action is refused, one added later too, so a new game action is
 * paused without a change here.
 */
const ALLOWED: ReadonlySet<string> = new Set([
  'options',
  'pushOptions',
  'read',
  'delrep',
  'delall',
  'rename',
  'mainPlanet',
  'endVacation',
  'settings',
  'reset',
  'endzeit',
]);

/**
 * Whether `action` is refused for a player whose vacation started at
 * `vacation` (null: none). The guild actions (`social`) stay allowed [V].
 */
export const vacationRefuses = (
  action: string,
  social: boolean,
  vacation: number | null,
): boolean => vacation !== null && !social && !ALLOWED.has(action);

/**
 * Up to when a place last settled at `from` produces on its way to `until`
 * (Q2): to the start of the vacation at most, never before `from`.
 */
export const producesUntil = (
  from: number,
  until: number,
  vacation: number | null | undefined,
): number =>
  vacation === null || vacation === undefined
    ? until
    : Math.max(from, Math.min(until, vacation));
