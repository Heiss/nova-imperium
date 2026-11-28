// The explanation of a setting of the admin panel (#358): its text and its
// table, from the registry entry of the setting (src/core/admin-explain.ts)
// and the universe and round of the state. Only the admin reads it; it is no
// part of the players' Lexicanum.
import {
  explainedSettings,
  explainTable,
  OWN_LABEL,
  ownRefused,
  ownValue,
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

/**
 * Whether the „?“ `opener` stands at `place`: the panel of the tab
 * „Universum“ and the panel inside the dialog „Neue Runde“ each show only
 * what was opened there (PR #471).
 */
export const openedAt = (opener: string | null, place: 'u' | 'r'): boolean =>
  opener?.startsWith(explainButtonId('', place)) === true;

/** The id of the field „Eigener Wert“ and of its refusal (#358, part 2). */
export const OWN_FIELD_ID = 'axp-own';

/** The field „Eigener Wert“ of a setting with a formula behind it (#358, part 2). */
export interface OwnField {
  label: string;
  min: number;
  max: number;
  step: number;
  /** Why the typed value adds no column, or adds one of none; else null. */
  error: string | null;
}

/** What the panel shows of a setting. */
export interface ExplainPage {
  key: string;
  label: string;
  text: string;
  table: { head: string[]; rows: string[][] } | null;
  /** The field for a value of the admin's own, while the table is shown. */
  own: OwnField | null;
}

let settings: readonly Explained[] | null = null;
const all = (): readonly Explained[] => (settings ??= explainedSettings());

/**
 * The explanation of the setting stored under `key`, or null for none; with
 * `typed`, the value the admin typed into „Eigener Wert“ (#358, part 2), a
 * column more when it is a value of the setting.
 */
export function explainPage(
  key: string,
  s: Pick<GameState, 'cfg' | 'round'>,
  typed = '',
): ExplainPage | null {
  const setting = all().find((x) => x.key === key);
  if (!setting?.explain) return null;
  const own = ownValue(setting, typed);
  const value = own && 'value' in own ? own.value : undefined;
  const table = explainTable(setting, s.cfg, s.round, undefined, value);
  return {
    key,
    label: setting.label,
    text: setting.explain.text,
    table: table && {
      head: table.head,
      rows: table.rows.map((r) => r.cells.map(String)),
    },
    own:
      table && setting.explain.own
        ? {
            label: OWN_LABEL,
            min: setting.min!,
            max: setting.max!,
            step: setting.step ?? 1,
            error:
              own && 'error' in own
                ? own.error
                : value === undefined
                  ? null
                  : ownRefused(setting, s.cfg, s.round, value),
          }
        : null,
  };
}
