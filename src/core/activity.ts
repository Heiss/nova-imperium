// The public activity markers (#229, okf/features/activity-indicators.md):
// activity per planet and moon, inactivity per account (owner, 2026-11-16,
// D1). One rule for the Sternenkarte and the spy report of #175 (D2).
//
// Which events set activity (owner, 2026-11-17): the classic rule of
// v0.76d with the change of v0.77b (owiki „Stern“, oldid=78225, section
// „Geschichtliches“; „Changelog vor Redesign“, oldid=78869). A login sets
// activity only on the main planet; any manual action in the account sets
// it on all planets and moons; fleets (own or foreign), spying and finished
// buildings set none.
//
// The thresholds are per-round values with the classic defaults (Q1, X1):
// recent activity for 15 minutes, then the minutes up to 59, nothing after
// an hour (owiki „Stern“ and „Galaxiemenü“, oldid=77826); inactive after 7
// days, long inactive after 28 days (owiki „Inaktivität“, oldid=78925).
import type { RoundGroup, RoundSetting } from './round.ts';

/** One minute and one day in milliseconds; activity runs in real time. */
export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

/** The thresholds of a round, in whole minutes and whole days. */
export interface ActivityLimits {
  /** Minutes after an activity in which only „recent“ is shown, not the minutes. */
  recent: number;
  /** The last minute after an activity that is still shown. */
  minutes: number;
  /** Days without activity after which an account is inactive. */
  inactive: number;
  /** Days without activity after which an account is long inactive. */
  longInactive: number;
}

type LimitPart = keyof ActivityLimits;

/** The classic thresholds (owner, 2026-11-16, Q1). */
export const ACTIVITY_DEFAULT: Readonly<ActivityLimits> = {
  recent: 15,
  minutes: 59,
  inactive: 7,
  longInactive: 28,
};

/** The range of each threshold the admin may set [V]. */
export const ACTIVITY_RANGE: Readonly<
  Record<LimitPart, { min: number; max: number }>
> = {
  recent: { min: 1, max: 60 },
  minutes: { min: 1, max: 1440 },
  inactive: { min: 1, max: 365 },
  longInactive: { min: 1, max: 365 },
};

/**
 * The thresholds in the dialog „Neue Runde“ and its request „reset“ (#283;
 * owner, 2026-11-18): one fieldset with the legend „Aktivität“, like the
 * rewards; sent as one object `activity` and refused together, every wrong
 * threshold at once.
 */
const ACTIVITY_GROUP: RoundGroup = { name: 'activity', legend: 'Aktivität' };

/** What the four thresholds share as settings of the round. */
const limit = <P extends LimitPart>(part: P) =>
  ({
    kind: 'number',
    group: ACTIVITY_GROUP,
    min: ACTIVITY_RANGE[part].min,
    max: ACTIVITY_RANGE[part].max,
    def: ACTIVITY_DEFAULT[part],
    live: true,
  }) as const;

/**
 * The heading of these settings in the admin panel (#357), the name the game
 * uses for the feature: the labels of its settings; the Lexicanum page „Sichtbarkeit und Aktivität“ [V].
 */
export const roundHeading = 'Aktivität';

/**
 * The thresholds as settings of the round (#283): number fields of the
 * dialog „Neue Runde“ and, `live`, rows of the universe settings, changed
 * during the round (X1); existing universes start with the classic values.
 * Refused with the range wording of the universe settings. The export under
 * this name registers them (#310, src/core/round.ts).
 */
export const roundSettings = [
  {
    ...limit('recent'),
    key: 'roundActivityRecent',
    name: 'activityRecent',
    label: 'Aktivität ohne Minutenangabe (Minuten)',
    order: 60,
  },
  {
    ...limit('minutes'),
    key: 'roundActivityMinutes',
    name: 'activityMinutes',
    label: 'Aktivität mit Minutenangabe bis (Minuten)',
    order: 70,
  },
  {
    ...limit('inactive'),
    key: 'roundInactiveDays',
    name: 'inactiveDays',
    label: 'Inaktiv ab (Tage)',
    order: 80,
  },
  {
    ...limit('longInactive'),
    key: 'roundLongInactiveDays',
    name: 'longInactiveDays',
    label: 'Lange inaktiv ab (Tage)',
    order: 90,
  },
] as const satisfies readonly RoundSetting[];

/** The four values of the round the thresholds are read from. */
export interface ActivityRound {
  activityRecent: number;
  activityMinutes: number;
  inactiveDays: number;
  longInactiveDays: number;
}

/** The thresholds of a round, from its rules. */
export const activityLimits = (round: ActivityRound): ActivityLimits => ({
  recent: round.activityRecent,
  minutes: round.activityMinutes,
  inactive: round.inactiveDays,
  longInactive: round.longInactiveDays,
});

/** The events of the classic list; only `login` and `action` set activity. */
export type ActivityEvent =
  | 'login'
  | 'action'
  | 'fleetSent'
  | 'fleetArrived'
  | 'fleetRecalled'
  | 'fleetReturned'
  | 'spied'
  | 'buildingDone';

/**
 * The places an event sets activity on: a login only the main planet, a
 * manual action every own planet and moon, every other event none.
 */
export function activityPlaces(
  event: ActivityEvent,
  own: readonly string[],
  main: string | null,
): string[] {
  if (event === 'action') return [...own];
  if (event === 'login') return main === null ? [] : [main];
  return [];
}

/**
 * The public activity of a planet or moon: `recent` within the first
 * minutes, then the whole minutes since the activity `at` up to the limit;
 * nothing later. A place without any activity has no time and is not asked.
 */
export type PlanetActivity = { recent: true } | { minutes: number };

export function planetActivity(
  at: number,
  now: number,
  limits: Readonly<ActivityLimits>,
): PlanetActivity | null {
  const minutes = Math.floor(Math.max(0, now - at) / MINUTE_MS);
  if (minutes < limits.recent) return { recent: true };
  return minutes <= limits.minutes ? { minutes } : null;
}

/** The inactivity of an account: none, inactive or long inactive. */
export type Inactivity = 'inactive' | 'long';

/** The inactivity of an account whose last activity was at `last`. */
export function inactivity(
  last: number,
  now: number,
  limits: Readonly<ActivityLimits>,
): Inactivity | null {
  const days = (now - last) / DAY_MS;
  if (days >= limits.longInactive) return 'long';
  return days >= limits.inactive ? 'inactive' : null;
}
