import type { RoundRules } from '../../core/round.ts';
import type { V } from './common.ts';
import { admin } from './misc.ts';

export const VIEWS: Record<string, (v: V) => string> = {
  admin,
};

export interface MenuEntry {
  view: string;
  label: string;
}

export function menu(admin: boolean, round: RoundRules): (MenuEntry | '-')[] {
  const items: (MenuEntry | '-')[] = [
    { view: 'overview', label: 'Übersicht' },
    { view: 'buildings', label: 'Gebäude' },
    { view: 'resources', label: 'Rohstoffe' },
    { view: 'market', label: 'Marktplatz' },
    { view: 'research', label: 'Forschung' },
    { view: 'shipyard', label: 'Schiffsschmiede' },
    { view: 'defense', label: 'Verteidigung' },
    '-',
    { view: 'fleet', label: 'Flotte' },
    { view: 'galaxy', label: 'Sternenkarte' },
    { view: 'messages', label: 'Nachrichten' },
    { view: 'highscore', label: 'Highscore' },
  ];
  // No „Gilden“ in a round with guilds off (#191).
  if (round.guilds) items.push({ view: 'guilds', label: 'Gilden' });
  // The buddy list (#227), with guilds on or off.
  items.push({ view: 'friends', label: 'Freunde' });
  if (round.achievements || round.daily)
    items.push({
      view: 'achievements',
      label: round.achievements ? 'Achievements' : 'Tagesbelohnung',
    });
  items.push(
    '-',
    { view: 'news', label: 'Neuigkeiten' },
    // The Lexicanum before „Optionen“; on a phone under „Mehr“ (#285 B9, #288).
    { view: 'lexicanum', label: 'Lexicanum' },
    { view: 'help', label: 'Optionen' },
  );
  if (admin) items.push({ view: 'admin', label: 'Admin' });
  return items;
}

/**
 * Phone: four destinations in the bottom tab bar, the rest under „Mehr“
 * (issue #61). #189 (D1, owner 2026-11-14): Übersicht, Bauen, Flotte and Karte;
 * the messages move to the bell of the header, and „Bauen“ is the list of
 * buildings with a switch to the other three lists.
 */
export const TAB_VIEWS = ['overview', 'buildings', 'fleet', 'galaxy'] as const;

/** The labels of the tab bar where they differ from the menu. */
const TAB_LABELS: Readonly<Record<string, string>> = { buildings: 'Bauen' };

export function phoneMenu(items: (MenuEntry | '-')[]): {
  tabs: MenuEntry[];
  more: MenuEntry[];
} {
  const entries = items.filter((i): i is MenuEntry => i !== '-');
  const isTab = (i: MenuEntry): boolean =>
    (TAB_VIEWS as readonly string[]).includes(i.view);
  return {
    tabs: TAB_VIEWS.map((v) => {
      const entry = entries.find((i) => i.view === v)!;
      return { ...entry, label: TAB_LABELS[v] ?? entry.label };
    }),
    more: entries.filter((i) => !isTab(i)),
  };
}

const glyph = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

/** Line icons of the tab bar; they follow the text colour. */
export const TAB_GLYPHS: Record<string, string> = {
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
