// The public activity markers in the browser (#229,
// okf/features/activity-indicators.md): the words of the markers on the
// Sternenkarte and the thresholds of the dialog „Neue Runde“, named as in
// the universe settings, where the admin changes them during the round
// (X1). The server sends only the markers and checks the thresholds.
import type { RoundRules } from '../../core/achievements.ts';
import {
  ACTIVITY_KEYS,
  ACTIVITY_PARTS,
  type ActivityLimits,
  type Inactivity,
  type PlanetActivity,
} from '../../core/activity.ts';
import { UNIVERSE_SPECS, type UniverseSpec } from '../../core/universe.ts';

type LimitPart = keyof ActivityLimits;

/** One threshold in the dialog: its input and the setting it stands for. */
interface ActivityInput {
  part: LimitPart;
  id: string;
  spec: UniverseSpec;
}

export const ACTIVITY_INPUTS: readonly ActivityInput[] = ACTIVITY_PARTS.map(
  (part) => ({
    part,
    id: `round-activity-${part}`,
    spec: UNIVERSE_SPECS.find((s) => s.key === ACTIVITY_KEYS[part])!,
  }),
);

/** A field as a number; an empty one as none, so the server refuses it. */
const num = (raw: string): number | null =>
  raw.trim() === '' ? null : Number(raw);

/** The thresholds the dialog sends with „Ja, neue Runde“; `val` reads an input. */
export const activityNumbers = (
  val: (sel: string) => string,
): Record<LimitPart, number | null> =>
  Object.fromEntries(
    ACTIVITY_INPUTS.map((i) => [i.part, num(val(`#${i.id}`))]),
  ) as Record<LimitPart, number | null>;

/** The number of minutes in German: one „Minute“, otherwise „Minuten“. */
const minutesText = (n: number | string): string =>
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

/** The marker after a planet's name on the Sternenkarte, or nothing; the round's thresholds word it. */
export const activityMark = (
  a: PlanetActivity | undefined,
  round: Pick<RoundRules, 'activity'>,
): string =>
  a ? ` <span class="dim">(${activityText(a, round.activity)})</span>` : '';

/** The marker after a player's name on the Sternenkarte, or nothing. */
export const inactivityMark = (i: Inactivity | undefined): string =>
  i ? ` <span class="dim">(${INACTIVITY_TEXT[i]})</span>` : '';

/**
 * The activity in the Auspex-Bericht (#175 D5, Q3): the words of the
 * Sternenkarte, or „Keine Aktivität in der letzten Stunde.“ [V] without one;
 * nothing for a report from before #175, which has no activity.
 */
export const spyActivityText = (
  a: PlanetActivity | null | undefined,
  round: Pick<RoundRules, 'activity'>,
): string | null => {
  if (a === undefined) return null;
  return a ? activityText(a, round.activity) : NO_ACTIVITY;
};

/** The words of a report without activity in the last hour [V]. */
export const NO_ACTIVITY = 'Keine Aktivität in der letzten Stunde.';
