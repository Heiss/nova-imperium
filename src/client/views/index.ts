import type { RoundRules } from '../../core/round.ts';
import {
  assembleGlyphs,
  assembleHtml,
  assembleMenu,
  assembleTabs,
  type Placed,
} from './assemble.ts';
import type { V } from './common.ts';
import type { MenuItem, Tab } from './contract.ts';
import { CLIENT_VIEWS } from './views.gen.ts';

/** The views drawn as HTML: the frame (not moved into a module yet) and the modules. */
export const VIEWS: Record<string, (v: V) => string> = assembleHtml(
  {},
  CLIENT_VIEWS,
);

export interface MenuEntry {
  view: string;
  label: string;
}

/**
 * The entries of the menu that are not moved into a module of their own yet
 * (#317): a new view gives its entry in `clientViews` (contract.ts), and the
 * numbers say where it stands among these.
 */
const FRAME_MENU: readonly Placed<MenuItem>[] = [
  { view: 'overview', order: 10, label: 'Übersicht' },
  { view: 'buildings', order: 20, label: 'Gebäude' },
  { view: 'resources', order: 30, label: 'Rohstoffe' },
  { view: 'market', order: 40, label: 'Marktplatz' },
  { view: 'research', order: 50, label: 'Forschung' },
  { view: 'shipyard', order: 60, label: 'Schiffsschmiede' },
  { view: 'defense', order: 70, label: 'Verteidigung' },
  { view: 'fleet', order: 80, label: 'Flotte', divider: true },
  { view: 'galaxy', order: 90, label: 'Sternenkarte' },
  { view: 'messages', order: 100, label: 'Nachrichten' },
  { view: 'highscore', order: 110, label: 'Highscore' },
  // No „Gilden“ in a round with guilds off (#191).
  {
    view: 'guilds',
    order: 120,
    label: 'Gilden',
    show: (round) => round.guilds,
  },
  // The buddy list (#227), with guilds on or off.
  { view: 'friends', order: 130, label: 'Freunde' },
  {
    view: 'achievements',
    order: 140,
    label: (round) => (round.achievements ? 'Achievements' : 'Tagesbelohnung'),
    show: (round) => round.achievements || round.daily,
  },
  { view: 'news', order: 150, label: 'Neuigkeiten', divider: true },
  // The Lexicanum before „Optionen“; on a phone under „Mehr“ (#285 B9, #288).
  { view: 'lexicanum', order: 160, label: 'Lexicanum' },
  { view: 'help', order: 170, label: 'Optionen' },
];

/** The frame and the modules in the order of their numbers. */
const MENU = assembleMenu(FRAME_MENU, CLIENT_VIEWS);

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
const FRAME_TABS: readonly Placed<Tab>[] = [
  { view: 'overview', order: 10 },
  // The labels of the tab bar where they differ from the menu.
  { view: 'buildings', order: 20, label: 'Bauen' },
  { view: 'fleet', order: 30 },
  { view: 'galaxy', order: 40 },
];
const TABS = assembleTabs(FRAME_TABS, CLIENT_VIEWS);

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

const glyph = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

/** Line icons of the tab bar; they follow the text colour. A view's own is in its `clientViews`. */
const FRAME_GLYPHS: Record<string, string> = {
  overview: glyph(
    '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-20 12 12)"/>',
  ),
  buildings: glyph(
    '<path d="M3 21h18M5 21V10l3-2V5h2v2l2-2 2 2V5h2v3l3 2v11"/><path d="M10 21v-5h4v5"/>',
  ),
  fleet: glyph(
    '<path d="M3 12l7-3 11 3-11 3z"/><path d="M8 9.8L6 5l5 3.5M8 14.2L6 19l5-3.5"/>',
  ),
  messages: glyph(
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
  ),
  galaxy: glyph(
    '<path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 15l-5 3.2 1.4-5.6L4 8.8l5.8-.5z"/>',
  ),
  bell: glyph(
    '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  ),
  more: glyph(
    '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  ),
  chevron: glyph('<path d="M9 5l7 7-7 7"/>'),
};

export const TAB_GLYPHS: Record<string, string> = assembleGlyphs(
  FRAME_GLYPHS,
  CLIENT_VIEWS,
);
