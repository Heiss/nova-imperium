import type { RoundRules } from '../../core/round.ts';
import {
  assembleGlyphs,
  assembleHtml,
  assembleMenu,
  assembleTabs,
} from './assemble.ts';
import type { V } from './common.ts';
import type { MenuItem } from './contract.ts';
import { glyph } from './glyph.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

// The menu, the tab bar and the glyphs are put together from the `clientViews`
// of the modules of this folder (#317, contract.ts); no view is named here.

/** The views drawn as HTML. */
export const VIEWS: Record<string, (v: V) => string> =
  assembleHtml(CLIENT_VIEWS);

export interface MenuEntry {
  view: string;
  label: string;
}

/** The entries of all views in the order of their numbers. */
const MENU = assembleMenu(CLIENT_VIEWS);

const labelOf = (item: MenuItem, round: RoundRules): string =>
  typeof item.label === 'function' ? item.label(round) : item.label;

export function menu(admin: boolean, round: RoundRules): (MenuEntry | '-')[] {
  return MENU.filter((item) => item.show?.(round, admin) ?? true).flatMap(
    (item) => [
      ...(item.divider ? (['-'] as const) : []),
      { view: item.view, label: labelOf(item, round) },
    ],
  );
}

/**
 * Phone: four destinations in the bottom tab bar, the rest under „Mehr“
 * (issue #61). #189 (D1, owner 2026-11-14): Übersicht, Bauen, Flotte and Karte;
 * the messages move to the bell of the header, and „Bauen“ is the list of
 * buildings with a switch to the other three lists.
 */
const TABS = assembleTabs(CLIENT_VIEWS);

export const TAB_VIEWS: readonly string[] = TABS.map((tab) => tab.view);

export function phoneMenu(items: (MenuEntry | '-')[]): {
  tabs: MenuEntry[];
  more: MenuEntry[];
} {
  const entries = items.filter((i): i is MenuEntry => i !== '-');
  const isTab = (i: MenuEntry): boolean => TAB_VIEWS.includes(i.view);
  return {
    tabs: TABS.map((tab) => {
      const entry = entries.find((i) => i.view === tab.view)!;
      return { ...entry, label: tab.label ?? entry.label };
    }),
    more: entries.filter((i) => !isTab(i)),
  };
}

/** Line icons that belong to no view (the bell, „Mehr“, the arrow); a view's own is in its `clientViews`. */
const FRAME_GLYPHS: Record<string, string> = {
  bell: glyph(
    '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  ),
  more: glyph(
    '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  ),
  chevron: glyph('<path d="M9 5l7 7-7 7"/>'),
};

export const TAB_GLYPHS: Record<string, string> = {
  ...FRAME_GLYPHS,
  ...assembleGlyphs(CLIENT_VIEWS),
};
