// The ▤ icon of the level overview next to the „?“ of a building or
// research (#187): what a row of the list shows of it, and the choices of
// the option „Stufenübersicht“ in „Hilfe & Optionen“. The table itself is
// built by logic/level-overview.ts and loads when it is shown.
import {
  LEVEL_MODES,
  type LevelMode,
  levelMode,
} from '../../core/level-overview.ts';

/** Labels of the option „Stufenübersicht“ (#187, [V]). */
const LABELS: Record<LevelMode, string> = {
  always: 'Immer anzeigen',
  icon: 'Als ▤-Symbol',
  hidden: 'Ausblenden',
};

/** What a row shows of the level overview of its entry. */
export interface LevelsRow {
  /** The catalog key of the entry. */
  key: string;
  /** Id of the ▤ button; null when the table is always shown (no button). */
  button: string | null;
  /** Id of the box that holds the table. */
  panel: string;
  name: string;
  /** Whether the player unfolded the table with the ▤. */
  open: boolean;
  /** Whether the table is in the row now. */
  show: boolean;
}

/**
 * The level overview of an entry with levels, or null in the mode
 * „Ausblenden“. `opened` holds the entries whose ▤ the player pressed.
 */
export function levelsRow(
  key: string,
  name: string,
  mode: unknown,
  opened: Record<string, boolean> | undefined,
): LevelsRow | null {
  const m = levelMode(mode);
  if (m === 'hidden') return null;
  const open = opened?.[key] === true;
  return {
    key,
    button: m === 'icon' ? `lvq_${key}` : null,
    panel: `lv_${key}`,
    name,
    open,
    show: m === 'always' || open,
  };
}

/** The choices of the option, the current mode selected. */
export const levelOptionsHTML = (mode: unknown): string =>
  LEVEL_MODES.map(
    (m) =>
      `<option value="${m}"${m === levelMode(mode) ? ' selected' : ''}>${LABELS[m]}</option>`,
  ).join('');
