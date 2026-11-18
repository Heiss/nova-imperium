// The public activity markers in the browser (#229,
// okf/features/activity-indicators.md): the words of the markers on the
// Sternenkarte. The server sends only the markers.
import type { Inactivity, PlanetActivity } from '../../core/activity.ts';

/** The number of minutes in German: one „Minute“, otherwise „Minuten“. */
const minutesText = (n: number): string =>
  `${n} ${n === 1 ? 'Minute' : 'Minuten'}`;

/**
 * The words of a planet's activity (owner, 2026-11-17 and 2026-11-18):
 * within the round's first threshold only „Aktiv“, after it „Aktivität vor
 * x Minuten“.
 */
export const activityText = (a: PlanetActivity): string =>
  'recent' in a ? 'Aktiv' : `Aktivität vor ${minutesText(a.minutes)}`;

/** The words of an account's inactivity (owner, 2026-11-17). */
export const INACTIVITY_TEXT: Readonly<Record<Inactivity, string>> = {
  inactive: 'Inaktiv',
  long: 'Lange inaktiv',
};

/** The words after a planet's name on the Sternenkarte, or nothing. */
export const activityNote = (a: PlanetActivity | undefined): string =>
  a ? activityText(a) : '';

/** The words after a player's name on the Sternenkarte, or nothing. */
export const inactivityNote = (i: Inactivity | undefined): string =>
  i ? INACTIVITY_TEXT[i] : '';
