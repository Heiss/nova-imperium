// The categories of the highscore (#422, owner, 2026-11-26): Gesamt,
// Wirtschaft (buildings, research and Sonnenreliquiare) and Militär (ships,
// defense and missiles), instead of the four of #78 (160a). Gesamt stays
// resources / 1,000. Wirtschaft and Militär each count by number („Anzahl“,
// the default, 167a) or by the resources spent / 1,000 („Rohstoffe“), a
// round setting each (166a, core/highscore-passes.ts). The notes are the
// owner's (168a).
import { SHIPS, UNIT, canFly } from './catalog.ts';
import type { Levels } from './types.ts';

/** How a category counts: by number (0, the default) or by resources (1). */
export type CountMode = 0 | 1;

/** The modes of Wirtschaft and Militär. */
export interface CategoryModes {
  economy: CountMode;
  military: CountMode;
}

/** The categories in the order of the buttons; „Gesamt“ first. */
export const HIGHSCORE_CATEGORIES = {
  total: 'Gesamt',
  economy: 'Wirtschaft',
  military: 'Militär',
} as const;

export type HighscoreCategory = keyof typeof HIGHSCORE_CATEGORIES;

/** The category of `key`, or „Gesamt“ for anything else. */
export const highscoreCategory = (key: unknown): HighscoreCategory =>
  typeof key === 'string' && Object.hasOwn(HIGHSCORE_CATEGORIES, key)
    ? (key as HighscoreCategory)
    : 'total';

/** A mode as stored: 1 is „Rohstoffe“, anything else „Anzahl“. */
const countMode = (value: unknown): CountMode => (value === 1 ? 1 : 0);

/** The modes of Wirtschaft and Militär a round sets (#422); a missing value is „Anzahl“. */
export const categoryModes = (
  round:
    | Partial<{ highscoreEconomy: number; highscoreMilitary: number }>
    | undefined,
): CategoryModes => ({
  economy: countMode(round?.highscoreEconomy),
  military: countMode(round?.highscoreMilitary),
});

/** The note under Gesamt, unchanged since #78. */
const TOTAL_NOTE =
  '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Schiffe, Verteidigung).';

/** The notes of the owner (168a), by category and mode. */
const NOTES: Record<'economy' | 'military', Record<CountMode, string>> = {
  economy: {
    0: '1 Punkt pro Gebäudestufe, Forschungsstufe und Sonnenreliquiar.',
    1: '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).',
  },
  military: {
    0: '1 Punkt pro Schiff, Verteidigungsanlage und Rakete.',
    1: '1 Punkt = 1.000 verbaute Rohstoffe (Flotte, Verteidigung, Raketen).',
  },
};

/** The note below the table: what a point of `cat` is worth in its mode. */
export const highscoreNote = (
  cat: HighscoreCategory,
  modes: CategoryModes,
): string => (cat === 'total' ? TOTAL_NOTE : NOTES[cat][modes[cat]]);

/** A category while it is summed: pieces and the resources in them. */
export interface Tally {
  count: number;
  value: number;
}

/** Wirtschaft and Militär of a player while they are summed. */
export interface CategoryTally {
  economy: Tally;
  military: Tally;
}

/**
 * A Sonnenreliquiar, the ship that does not fly, counts to Wirtschaft;
 * every other ship, the defense and the missiles to Militär (160a).
 */
export const isEconomyUnit = (key: string): boolean =>
  Object.hasOwn(SHIPS, key) && !canFly(key);

/** Adds the units of `units` to their category: one each, and their costs. */
export function addUnits(t: CategoryTally, units: Levels): void {
  for (const [k, n] of Object.entries(units)) {
    const d = UNIT[k];
    if (!d) continue;
    const c = isEconomyUnit(k) ? t.economy : t.military;
    c.count += n;
    c.value += (d.cost[0] + d.cost[1] + d.cost[2]) * n;
  }
}
