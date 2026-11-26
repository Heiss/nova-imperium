// The categories of the highscore (#78): one ranking each, chosen above the
// table, as in classic (owiki „Statistik“, D3). The view stays thin: the
// ranking, the buttons and the note come from here, as the page the component
// Highscore renders (#118, bundle 5).
import type { V } from '../views/common.ts';
import { fmt } from './format.ts';
import { type HomeLink, homeLink, homePlanetOf } from './friends.ts';
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
interface HighscoreButton {
  key: HighscoreCategory;
  label: string;
  pressed: boolean;
}

/** One line of the table: the place, the player, the home planet and the points. */
interface HighscoreRow {
  id: string;
  rank: number;
  /** The player's own line. */
  me: boolean;
  name: string;
  /** A planet, never a moon (#53); none until the player has one. */
  home: HomeLink | null;
  points: string;
}

/** What the page shows: the buttons, the table of the shown category and its note. */
export interface HighscorePage {
  buttons: HighscoreButton[];
  rows: HighscoreRow[];
  note: string;
  /** „Stand: {Uhrzeit}“: when the server computed the points (#405). */
  stand: string;
}

/** „Stand: {Uhrzeit}“ of the pass at `at`, the clock time of this browser (#405). */
export const highscoreStand = (at: number): string =>
  `Stand: ${new Date(at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

const PER_1000 = '1 Punkt = 1.000 verbaute Rohstoffe';

/**
 * The note below the table: what a point is worth. Fleet and research count
 * pieces and levels (Q1); their notes are the owner's (2026-11-17).
 */
const NOTES: Record<HighscoreCategory, string> = {
  total: `${PER_1000} (Gebäude, Forschung, Schiffe, Verteidigung).`,
  buildings: `${PER_1000} (Gebäude).`,
  research: '1 Punkt pro Forschungsstufe.',
  fleet: '1 Punkt pro Schiff (auch Sonnenreliquiare).',
  defense: `${PER_1000} (Verteidigung).`,
};

export const highscoreNote = (cat: HighscoreCategory): string => NOTES[cat];

/** The page of the category the player chose (#78 D3); `points` is that of the category. */
export function highscorePage(v: V): HighscorePage {
  const cat = highscoreCategory(v.ui.highscore);
  return {
    buttons: (
      Object.entries(HIGHSCORE_CATEGORIES) as [HighscoreCategory, string][]
    ).map(([key, label]) => ({ key, label, pressed: key === cat })),
    rows: highscoreRanking(v.s.players, cat).map(([id, x], i) => {
      const home = homePlanetOf(v.s.galaxy, id);
      return {
        id,
        rank: i + 1,
        me: id === v.s.me.id,
        name: x.name,
        home: homeLink(home),
        points: fmt(x.points),
      };
    }),
    note: highscoreNote(cat),
    // A state without it (a server before #405) has no line.
    stand: v.s.scoresAt === undefined ? '' : highscoreStand(v.s.scoresAt),
  };
}
