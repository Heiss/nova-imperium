// The public activity markers in the browser (#229,
// okf/features/activity-indicators.md): the words of the markers on the
// Sternenkarte. The server sends only the markers; the round's threshold
// words the first minutes.
import type {
  ActivityLimits,
  ActivityRound,
  Inactivity,
  PlanetActivity,
} from '../../core/activity.ts';

/** The number of minutes in German: one „Minute“, otherwise „Minuten“. */
const minutesText = (n: number): string =>
  `${n} ${n === 1 ? 'Minute' : 'Minuten'}`;

/**
 * The words of a planet's activity (owner, 2026-11-17): „Aktivität vor x
 * Minuten“; within the first minutes of the round's threshold without the
 * exact minutes [V].
 */
export const activityText = (
  a: PlanetActivity,
  limits: Pick<ActivityLimits, 'recent'>,
): string =>
  'recent' in a
    ? `Aktivität vor weniger als ${minutesText(limits.recent)}`
    : `Aktivität vor ${minutesText(a.minutes)}`;

/** The words of an account's inactivity (owner, 2026-11-17). */
export const INACTIVITY_TEXT: Readonly<Record<Inactivity, string>> = {
  inactive: 'Inaktiv',
  long: 'Lange inaktiv',
};

/** The words after a planet's name on the Sternenkarte, or nothing; the round's threshold words them. */
export const activityNote = (
  a: PlanetActivity | undefined,
  round: Pick<ActivityRound, 'activityRecent'>,
): string => (a ? activityText(a, { recent: round.activityRecent }) : '');

/** The words after a player's name on the Sternenkarte, or nothing. */
export const inactivityNote = (i: Inactivity | undefined): string =>
  i ? INACTIVITY_TEXT[i] : '';
