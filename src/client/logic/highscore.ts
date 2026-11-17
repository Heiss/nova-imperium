// The categories of the highscore (#78): one ranking each, chosen above the
// table, as in classic (owiki „Statistik“, D3). The view stays thin: the
// ranking, the buttons and the note come from here.
import type { Players } from './types.ts';

/** The categories in the order of the buttons; „Gesamt“ first. */
export const HIGHSCORE_CATEGORIES = {
  total: 'Gesamt',
  buildings: 'Gebäude',
  research: 'Forschung',
  fleet: 'Flotte',
  defense: 'Verteidigung',
} as const;

export type HighscoreCategory = keyof typeof HIGHSCORE_CATEGORIES;

/** The category of `key`, or „Gesamt“ for anything else. */
export const highscoreCategory = (key: unknown): HighscoreCategory =>
  typeof key === 'string' && Object.hasOwn(HIGHSCORE_CATEGORIES, key)
    ? (key as HighscoreCategory)
    : 'total';

/**
 * The players by their points in `cat`, best first; equal points keep the
 * order of `players`, as the total did. `points` is the value of `cat`.
 */
export function highscoreRanking(
  players: Players,
  cat: HighscoreCategory,
): [string, { name: string; points: number }][] {
  return Object.entries(players)
    .map(([id, x]): [string, { name: string; points: number }] => [
      id,
      {
        name: x.name,
        points: cat === 'total' ? x.points : (x.scores?.[cat] ?? 0),
      },
    ])
    .sort((a, b) => b[1].points - a[1].points);
}

/** One button per category; the shown one is pressed. */
export const highscoreButtonsHTML = (cat: HighscoreCategory): string =>
  `<div class="flex" role="group" aria-labelledby="highscore-h">${Object.entries(
    HIGHSCORE_CATEGORIES,
  )
    .map(
      ([key, label]) =>
        `<button type="button" data-act="highscore" data-cat="${key}" aria-pressed="${key === cat}">${label}</button>`,
    )
    .join('')}</div>`;

const PER_1000 = '1 Punkt = 1.000 verbaute Rohstoffe';

/**
 * The note below the table: what a point is worth. Fleet and research count
 * pieces and levels (Q1); their note is an open question to the owner.
 */
const NOTES: Record<HighscoreCategory, string> = {
  total: `${PER_1000} (Gebäude, Forschung, Schiffe, Verteidigung).`,
  buildings: `${PER_1000} (Gebäude).`,
  research: '',
  fleet: '',
  defense: `${PER_1000} (Verteidigung).`,
};

export const highscoreNote = (cat: HighscoreCategory): string => NOTES[cat];
