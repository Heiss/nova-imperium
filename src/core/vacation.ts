// The vacation mode („Urlaubsmodus“, #223, okf/features/vacation-mode.md):
// a player pauses the account in the options. Entry only when nothing runs
// (owner, 2026-11-16, Q1); during it the production pauses, the player can
// do nothing but end it and change the account (owner, 2026-11-18: a lock
// screen instead of the game) and every planet and moon is protected from new missions
// of other players (Q2, D2); it ends with „Urlaubsmodus beenden“ once the
// minimum duration of the round is over (D1; owner, 2026-11-17), or with a
// new round (D3). The server, the settlement and the options view ask these
// rules (patterns, section 7). `vacationProtects` is the one protection
// check of a target: holding, the attack union, missiles and the moon
// destruction (#55, #225, #54, #95) ask it too once they are built.
import { PM_ACTIONS } from './private-messages.ts';
import type { RoundSetting } from './round.ts';
import type { Planet } from './types.ts';

/** One hour in milliseconds; the minimum duration runs in real time. */
export const HOUR_MS = 3_600_000;

/** The minimum duration in whole hours: the admin's range per round [V] and the owner's default, 48 since 2026-11-18 (D1). */
export const VACATION_HOURS = { min: 1, max: 720, default: 48 } as const;

/**
 * The heading of these settings in the admin panel (#357), the name the game
 * uses for the feature: the Lexicanum page and the changelog entry „Urlaubsmodus“ [V].
 */
export const roundHeading = 'Urlaubsmodus';

/**
 * The minimum duration as a setting of the round (#283): a number field of
 * the dialog „Neue Runde“ and, `live`, a row of the universe settings,
 * changed during the round (X1, owner, 2026-11-17); existing universes keep
 * a vacation for the default 48 hours at least. The export under this name
 * registers it (#310, src/core/round.ts).
 */
export const roundSettings = [
  {
    kind: 'number',
    key: 'roundVacationHours',
    name: 'vacationHours',
    label: 'Mindestdauer des Urlaubsmodus (Stunden)',
    order: 150,
    min: VACATION_HOURS.min,
    max: VACATION_HOURS.max,
    def: VACATION_HOURS.default,
    refusal: `Bitte für die Mindestdauer des Urlaubsmodus ${VACATION_HOURS.min} bis ${VACATION_HOURS.max} ganze Stunden angeben.`,
    live: true,
  },
] as const satisfies readonly RoundSetting[];

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
 * The actions a player in vacation mode may still take (owner, 2026-11-18):
 * the end of the vacation, the push settings of the account and the private
 * messages (owner, 2026-11-21). Every
 * other action is refused, the guild actions, renaming a planet, the main
 * planet, the reading of messages and the admin's actions too, and one
 * added later as well, so a new action is locked without a change here. The
 * other account options (password, passkeys, deleting the account) and the
 * sign-out are routes of their own, not actions.
 */
const ALLOWED: ReadonlySet<string> = new Set([
  'endVacation',
  'pushOptions',
  // Private messages go on as normal (owner, 2026-11-21, Q25).
  ...PM_ACTIONS,
]);

/**
 * Whether `action` is refused for a player whose vacation started at
 * `vacation` (null: none).
 */
export const vacationRefuses = (
  action: string,
  vacation: number | null,
): boolean => vacation !== null && !ALLOWED.has(action);

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
