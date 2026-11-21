// The „?“ of the entries in the lists of buildings, research, shipyard and
// defense (issue #63): since the Lexicanum (#285) it opens the article of
// the entry, in the side panel on a desktop and as the page on a phone; the
// option „(?)-Symbol“ shows or hides it (B2).
import {
  DEFAULT_EXPLAIN,
  EXPLAIN_MODES,
  type ExplainMode,
  storedMode,
} from '../../core/explain.ts';

/** Labels of the option „(?)-Symbol“ (#285 B2, [V]). */
const LABELS: Record<ExplainMode, string> = {
  icon: 'Anzeigen',
  hidden: 'Ausblenden',
};

/** The id of the side panel of the Lexicanum that a „?“ opens. */
export const PANEL_ID = 'lexicanum-panel';

/** What an entry shows: the „?“ that opens its article. */
export interface Explanation {
  /** The catalog key of the entry, the id of its article. */
  key: string;
  /** Id of the „?“ button. */
  button: string;
  /** Id of the side panel it opens. */
  panel: string;
  name: string;
  /** Whether the side panel shows this entry now. */
  open: boolean;
}

/** The mode of the player; the default (D2) when the state has none. */
export const explainMode = (x: unknown): ExplainMode =>
  storedMode(x) ?? DEFAULT_EXPLAIN;

/**
 * The „?“ of a catalog entry, or null in the mode „Ausblenden“. `opened`
 * holds the entry the side panel shows.
 */
export function explanation(
  key: string,
  def: { n: string },
  mode: unknown,
  opened: Record<string, boolean>,
): Explanation | null {
  if (explainMode(mode) === 'hidden') return null;
  return {
    key,
    button: `exq_${key}`,
    panel: PANEL_ID,
    name: def.n,
    open: opened[key] === true,
  };
}

/**
 * The paragraphs of a text, split at blank lines: a long text has the lore
 * first and „So funktioniert es:“ second (#94).
 */
export const paragraphs = (text: string): string[] =>
  text.split('\n\n').map((p) => p.trim());

/** One choice of a selection of the options: its value, its label, and whether it is the current one. */
export interface Choice {
  value: string;
  label: string;
  selected: boolean;
}

/** The choices of the option, the current mode selected. */
export const explainChoices = (mode: unknown): Choice[] =>
  EXPLAIN_MODES.map((m) => ({
    value: m,
    label: LABELS[m],
    selected: m === explainMode(mode),
  }));
