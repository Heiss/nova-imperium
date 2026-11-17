// The data of the Lexicanum (#285): an article is an id, a kind, a title,
// keywords and a list of blocks. The blocks are data; the page and the side
// panel draw them with the same Svelte components (#118). Texts hold links
// as [[id]] or [[id|text]] (B7) and values as {name}, filled from the rules,
// so no number is typed into a text (#285, „Texts“).
import type { Levels, Universe } from '../types.ts';

/** The kinds of articles of stage 1: the catalog entries and the missions. */
export type ArticleKind =
  'building' | 'research' | 'ship' | 'defense' | 'mission';

/** A formula: its text (numbers allowed) and its function, checked against the rule (B8). */
export interface Formula {
  /** The formula as shown, with {name} values. */
  text: string;
  /** The values of the placeholders, from the rules. */
  values?: Readonly<Record<string, string>>;
  /** The formula as a small function of the sample values. */
  fn: (...x: number[]) => number;
  /** The rule of the game it states, on the same values. */
  rule: (...x: number[]) => number;
  /** The values a test compares `fn` and `rule` on. */
  samples: readonly (readonly number[])[];
}

/** A cell of a table: a text, or a number shown with the German format. */
export type Cell = string | number;

/** One row of a computed table; `mark` is the row that applies to the player (B5). */
export interface Row {
  cells: Cell[];
  mark?: boolean;
}

/** The blocks an article is made of. */
export type Block =
  | { t: 'heading'; id: string; text: string }
  | { t: 'text'; text: string }
  | { t: 'formula'; lines: string[] }
  | { t: 'chips'; items: { label: string; text: string }[] }
  | { t: 'table'; caption?: string; head: string[]; rows: Row[] }
  | { t: 'facts'; items: { label: string; text: string }[] }
  | { t: 'stand'; text: string }
  | { t: 'links'; items: { id: string; text?: string; note?: string }[] };

/** What the player has, for the computed blocks of an entry (B5). */
export interface LexState {
  /** The universe of the round. */
  u: Universe;
  /** The player's research. */
  research: Levels;
  /** The ships on the shown planet. */
  ships: Levels;
}

/** The effect of one level of an entry, for its level table and „Dein Stand“. */
export interface Effect {
  /** The heading of the column. */
  label: string;
  /** The value at a level. */
  at: (level: number) => number;
  /** How it is shown: a number, a percentage, or a number with a unit. */
  format?: 'percent';
  unit?: string;
}

/**
 * What an entry adds to its generated article, in its own folder
 * (`src/features/<key>/lexicon.de.ts`, exported as `lexicon`).
 */
export interface EntryLexicon {
  /** Words in everyday language that find the article, not shown (B6). */
  keywords?: readonly string[];
  /** Further articles for „Siehe auch“. */
  seeAlso?: readonly string[];
  /** The effect of a level, a column of the level table. */
  effect?: Effect;
  /** The formulas of „Was die Stufen bringen“. */
  formulas?: readonly Formula[];
  /** The texts of „Was die Stufen bringen“, before the computed blocks. */
  texts?: readonly {
    text: string;
    values?: Readonly<Record<string, string>>;
  }[];
  /** Computed blocks of „Was die Stufen bringen“ from the player's state. */
  blocks?: (s: LexState) => Block[];
}
