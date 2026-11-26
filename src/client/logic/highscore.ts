// The categories of the highscore: one ranking each, chosen above the
// table, as in classic (owiki „Statistik“, D3): Gesamt, Wirtschaft and
// Militär (#422, core/highscore-categories.ts). The view stays thin: the
// ranking, the buttons and the note come from here, as the page the component
// Highscore renders (#118, bundle 5).
import {
  categoryModes,
  HIGHSCORE_CATEGORIES,
  type HighscoreCategory,
  highscoreCategory,
  highscoreNote,
  highscoreShows,
  SHOWS,
} from '../../core/highscore-categories.ts';
import type { V } from '../views/common.ts';
import { fmt } from './format.ts';
import { type HomeLink, homeLink, homePlanetOf } from './friends.ts';
import type { Players } from './types.ts';

export { highscoreCategory, type HighscoreCategory };

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
        points: cat === 'total' ? (x.points ?? 0) : (x.scores?.[cat] ?? 0),
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

/** The page of the category the player chose (#78 D3); `points` is that of the category. */
export function highscorePage(v: V): HighscorePage {
  // „nur Gesamt“ (#422, 177a): Gesamt alone, without the other buttons.
  const totalOnly = highscoreShows(v.s.round) === SHOWS.total;
  const cat = totalOnly ? 'total' : highscoreCategory(v.ui.highscore);
  const shown = (
    Object.entries(HIGHSCORE_CATEGORIES) as [HighscoreCategory, string][]
  ).filter(([key]) => !totalOnly || key === 'total');
  return {
    buttons: shown.map(([key, label]) => ({
      key,
      label,
      pressed: key === cat,
    })),
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
    // The note of the mode the round sets now (#422, 168a).
    note: highscoreNote(cat, categoryModes(v.s.round)),
    // A state without it (a server before #405) has no line.
    stand: v.s.scoresAt === undefined ? '' : highscoreStand(v.s.scoresAt),
  };
}
