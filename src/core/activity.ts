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

/** The stored setting of each threshold, shared by the round and the universe settings (X1). */
export const ACTIVITY_KEYS = {
  recent: 'roundActivityRecent',
  minutes: 'roundActivityMinutes',
  inactive: 'roundInactiveDays',
  longInactive: 'roundLongInactiveDays',
} as const satisfies Record<LimitPart, string>;

export const ACTIVITY_PARTS = Object.keys(ACTIVITY_KEYS) as LimitPart[];

/** Whether `n` is a value the admin may set for the threshold `part`. */
export const isActivityLimit = (part: LimitPart, n: unknown): n is number =>
  Number.isInteger(n) &&
  (n as number) >= ACTIVITY_RANGE[part].min &&
  (n as number) <= ACTIVITY_RANGE[part].max;

/** The thresholds as sent, one not sent taken from the current round. */
function chosen(
  current: Readonly<ActivityLimits>,
  input: unknown,
): Record<LimitPart, unknown> {
  const sent = (
    typeof input === 'object' && input !== null ? input : {}
  ) as Partial<Record<LimitPart, unknown>>;
  return Object.fromEntries(
    ACTIVITY_PARTS.map((p) => [
      p,
      sent[p] === undefined ? current[p] : sent[p],
    ]),
  ) as Record<LimitPart, unknown>;
}

/**
 * The thresholds of a new round that are no whole number of their range,
 * in the order of ACTIVITY_PARTS (#214, patterns, section 7); the server
 * words them.
 */
export const activityLimitErrors = (
  current: Readonly<ActivityLimits>,
  input: unknown,
): LimitPart[] => {
  const choice = chosen(current, input);
  return ACTIVITY_PARTS.filter((p) => !isActivityLimit(p, choice[p]));
};

/** The thresholds of the new round, once `activityLimitErrors` refused none. */
export const activityLimitsOf = (
  current: Readonly<ActivityLimits>,
  input: unknown,
): ActivityLimits => chosen(current, input) as ActivityLimits;

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
 * minutes, then the whole minutes since the activity up to the limit;
 * nothing later or without any activity.
 */
export type PlanetActivity = { recent: true } | { minutes: number };

export function planetActivity(
  at: number | null | undefined,
  now: number,
  limits: Readonly<ActivityLimits>,
): PlanetActivity | null {
  if (at === null || at === undefined) return null;
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
