// The recognition of incoming fleets (#228, okf/features/espionage-defense.md):
// how much a player sees of a foreign fleet depends on the player's
// Auspex-Lehre (espionage technology). The total number of ships from one
// threshold, the ship types from a second, the exact number per type from a
// third; classic 2 / 4 / 8 by default, set by the admin per round (owner,
// 2026-11-16, D1) in the dialog „Neue Runde“ and in the universe settings
// (owner, 2026-11-17, X1). The thresholds apply to every foreign fleet
// (D2). The server sends only what is seen, so nothing hidden reaches the
// browser; each threshold counts on its own. The thresholds are three
// entries of the registry of the round settings (#283).
import type { RoundGroup, RoundSetting } from './round.ts';
import type { Levels } from './types.ts';

/** The level of the Auspex-Lehre from which each part of a foreign fleet is seen. */
export interface Recognition {
  /** The total number of ships. */
  total: number;
  /** The ship types, without their numbers. */
  types: number;
  /** The exact number per type. */
  counts: number;
}

/** The classic thresholds (owner, 2026-11-16, D1; source [U]). */
export const RECOGNITION_DEFAULT: Readonly<Recognition> = {
  total: 2,
  types: 4,
  counts: 8,
};

/** The range of a threshold, in whole levels [V]. */
export const RECOGNITION_LEVELS = { min: 0, max: 100 } as const;

/**
 * The three thresholds are sent and refused together in a new round; the
 * dialog shows them as number fields in one fieldset with the legend
 * „Fremde Flotten erkennen“ (owner, 2026-11-18).
 */
const RECOGNITION: RoundGroup = {
  name: 'recognition',
  legend: 'Fremde Flotten erkennen',
};

/** One threshold as a setting of the round (#283), `live` by X1. */
const threshold = <N extends string, K extends `round${string}`>(
  key: K,
  name: N,
  label: string,
  order: number,
  def: number,
) =>
  ({
    kind: 'number',
    key,
    name,
    label,
    order,
    group: RECOGNITION,
    ...RECOGNITION_LEVELS,
    def,
    live: true,
  }) as const satisfies RoundSetting;

/** The total number of ships, a setting of the round (#283). */
export const RECOGNITION_TOTAL_SETTING = threshold(
  'roundRecognitionTotal',
  'recognitionTotal',
  'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre',
  120,
  RECOGNITION_DEFAULT.total,
);

/** The ship types, a setting of the round (#283). */
export const RECOGNITION_TYPES_SETTING = threshold(
  'roundRecognitionTypes',
  'recognitionTypes',
  'Fremde Flotten: Schiffstypen ab Auspex-Lehre',
  130,
  RECOGNITION_DEFAULT.types,
);

/** The exact number per type, a setting of the round (#283). */
export const RECOGNITION_COUNTS_SETTING = threshold(
  'roundRecognitionCounts',
  'recognitionCounts',
  'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre',
  140,
  RECOGNITION_DEFAULT.counts,
);

/** The thresholds among the rules of a round. */
export const recognitionOf = (round: {
  recognitionTotal: number;
  recognitionTypes: number;
  recognitionCounts: number;
}): Recognition => ({
  total: round.recognitionTotal,
  types: round.recognitionTypes,
  counts: round.recognitionCounts,
});

/**
 * What an observer sees of the ships of a foreign fleet: each part only
 * from its threshold on, otherwise absent (unknown, never 0). A type of 0
 * ships is not in the fleet.
 */
export interface SeenShips {
  total?: number;
  types?: string[];
  ships?: Levels;
}

export function seenShips(
  ships: Levels,
  level: number,
  r: Readonly<Recognition>,
): SeenShips {
  const present = Object.entries(ships).filter(([, n]) => n > 0);
  const seen: SeenShips = {};
  if (level >= r.total) seen.total = present.reduce((a, [, n]) => a + n, 0);
  if (level >= r.types) seen.types = present.map(([k]) => k);
  if (level >= r.counts) seen.ships = Object.fromEntries(present);
  return seen;
}
