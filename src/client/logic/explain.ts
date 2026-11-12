// Explanation texts in the lists of buildings, research, shipyard and defense
// (issue #63): what an entry shows in the display mode of the player.
import {
  DEFAULT_EXPLAIN,
  EXPLAIN_MODES,
  type ExplainMode,
  isExplainMode,
  longText,
} from '../../shared/explain.ts';
import { esc } from './format.ts';

/** Labels of the option „Erklärungstexte“ (drafts of the issue, [V]). */
const LABELS: Record<ExplainMode, string> = {
  always: 'Immer anzeigen',
  icon: 'Als (?)-Symbol',
  hidden: 'Ausblenden',
};

/** What an entry shows: its text in a panel, opened by a (?) or always. */
export interface Explanation {
  /** The catalog key of the entry. */
  key: string;
  /** Id of the (?) button. */
  button: string;
  /** Id of the panel below the entry. */
  panel: string;
  name: string;
  text: string;
  /** Whether a (?) button opens and closes the panel. */
  toggle: boolean;
  open: boolean;
}

/** The mode of the player; the default (D2) when the state has none. */
export const explainMode = (x: unknown): ExplainMode =>
  isExplainMode(x) ? x : DEFAULT_EXPLAIN;

/**
 * The explanation of a catalog entry, or null when nothing is shown: in the
 * mode „Ausblenden“ or for an entry without any text. `opened` holds the
 * entries whose (?) the player opened on this page.
 */
export function explanation(
  key: string,
  def: { n: string; lt?: string; ds?: string },
  mode: unknown,
  opened: Record<string, boolean>,
): Explanation | null {
  const text = longText(def);
  const m = explainMode(mode);
  if (!text || m === 'hidden') return null;
  const toggle = m === 'icon';
  return {
    key,
    button: `exq_${key}`,
    panel: `ex_${key}`,
    name: def.n,
    text,
    toggle,
    open: !toggle || opened[key] === true,
  };
}

/** The (?) next to the name; a real button for touch, keyboard and screen readers (D3). */
export const explainButtonHTML = (ex: Explanation | null): string =>
  ex?.toggle
    ? `<button type="button" class="exq" id="${ex.button}" data-act="explain" data-k="${ex.key}" aria-expanded="${ex.open}" aria-controls="${ex.panel}" aria-label="Erklärung zu ${esc(ex.name)}">?</button>`
    : '';

/**
 * The paragraphs of a text, split at blank lines: a long text has the lore
 * first and „So funktioniert es:“ second (#94).
 */
export const paragraphs = (text: string): string[] =>
  text.split('\n\n').map((p) => p.trim());

/** The panel below the entry, one escaped paragraph each. */
export const explainPanelHTML = (ex: Explanation | null): string =>
  ex
    ? `<div class="ex" id="${ex.panel}"${ex.open ? '' : ' hidden'}>${paragraphs(
        ex.text,
      )
        .map((p) => `<p>${esc(p)}</p>`)
        .join('')}</div>`
    : '';

/** The choices of the option, the current mode selected. */
export const explainOptionsHTML = (mode: unknown): string =>
  EXPLAIN_MODES.map(
    (m) =>
      `<option value="${m}"${m === explainMode(mode) ? ' selected' : ''}>${LABELS[m]}</option>`,
  ).join('');
