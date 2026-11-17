// The recognition of incoming fleets (#228, okf/features/espionage-defense.md):
// how much a player sees of a foreign fleet depends on the player's
// Auspex-Lehre (espionage technology). The total number of ships from one
// threshold, the ship types from a second, the exact number per type from a
// third; classic 2 / 4 / 8 by default, set by the admin per round (owner,
// 2026-11-16, D1) in the dialog „Neue Runde“ and in the universe settings
// (owner, 2026-11-17, X1). The thresholds apply to every foreign fleet
// (D2). The server sends only what is seen, so nothing hidden reaches the
// browser; each threshold counts on its own.
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

type RecognitionPart = keyof Recognition;

/** The classic thresholds (owner, 2026-11-16, D1; source [U]). */
export const RECOGNITION_DEFAULT: Readonly<Recognition> = {
  total: 2,
  types: 4,
  counts: 8,
};

/** The range of a threshold, in whole levels [V]. */
export const RECOGNITION_LEVELS = { min: 0, max: 100 } as const;

/** The stored setting of each threshold, shared by the round and the universe settings. */
export const RECOGNITION_KEYS = {
  total: 'roundRecognitionTotal',
  types: 'roundRecognitionTypes',
  counts: 'roundRecognitionCounts',
} as const satisfies Record<RecognitionPart, string>;

const PARTS = Object.keys(RECOGNITION_KEYS) as RecognitionPart[];

/** Whether `n` is a threshold the admin may set. */
export const isRecognitionLevel = (n: unknown): n is number =>
  Number.isInteger(n) &&
  (n as number) >= RECOGNITION_LEVELS.min &&
  (n as number) <= RECOGNITION_LEVELS.max;

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

/** The thresholds as sent, one not sent taken from the current round. */
function chosen(
  current: Readonly<Recognition>,
  input: unknown,
): Record<RecognitionPart, unknown> {
  const sent = (
    typeof input === 'object' && input !== null ? input : {}
  ) as Partial<Record<RecognitionPart, unknown>>;
  return {
    total: sent.total === undefined ? current.total : sent.total,
    types: sent.types === undefined ? current.types : sent.types,
    counts: sent.counts === undefined ? current.counts : sent.counts,
  };
}

/**
 * The thresholds of a new round that are no whole level of the range, in
 * the order total, types, counts (#214, patterns, section 7); the server
 * words them.
 */
export const recognitionErrors = (
  current: Readonly<Recognition>,
  input: unknown,
): RecognitionPart[] => {
  const choice = chosen(current, input);
  return PARTS.filter((p) => !isRecognitionLevel(choice[p]));
};

/** The thresholds of the new round, once `recognitionErrors` refused none. */
export const recognitionOf = (
  current: Readonly<Recognition>,
  input: unknown,
): Recognition => chosen(current, input) as Recognition;
