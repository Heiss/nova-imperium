// The explanation of a setting of the admin panel (#358): its text and its
// table, from the registry entry of the setting (src/core/admin-explain.ts)
// and the universe and round of the state. Only the admin reads it; it is no
// part of the players' Lexicanum.
import {
  explainedSettings,
  explainTable,
  type Explained,
} from '../../core/admin-explain.ts';
import type { GameState } from './types.ts';

/** The id of the side panel of the explanations. */
export const EXPLAIN_PANEL_ID = 'admin-explain-panel';

/**
 * The id of the „?“ of a setting, which gets the focus back when the panel
 * closes: `u` in the tab „Universum“, `r` in the dialog „Neue Runde“, which
 * can both be on the page.
 */
export const explainButtonId = (key: string, place: 'u' | 'r'): string =>
  `axq${place}_${key}`;

/** What the panel shows of a setting. */
export interface ExplainPage {
  key: string;
  label: string;
  text: string;
  table: { head: string[]; rows: string[][] } | null;
}

let settings: readonly Explained[] | null = null;
const all = (): readonly Explained[] => (settings ??= explainedSettings());

/** The explanation of the setting stored under `key`, or null for none. */
export function explainPage(
  key: string,
  s: Pick<GameState, 'cfg' | 'round'>,
): ExplainPage | null {
  const setting = all().find((x) => x.key === key);
  if (!setting?.explain) return null;
  const table = explainTable(setting, s.cfg, s.round);
  return {
    key,
    label: setting.label,
    text: setting.explain.text,
    table: table && {
      head: table.head,
      rows: table.rows.map((r) => r.cells.map(String)),
    },
  };
}
