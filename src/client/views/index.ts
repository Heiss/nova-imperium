import type { RoundRules } from '../../core/achievements.ts';
import { achievements } from './achievements.ts';
import type { V } from './common.ts';
import { research, resources } from './economy.ts';
import { fleet } from './fleet.ts';
import { galaxy } from './galaxy.ts';
import { guilds } from './guilds.ts';
import { newsHTML } from '../logic/news.ts';
import { messages } from './messages.ts';
import { admin, help, highscore } from './misc.ts';
import { overview } from './overview.ts';
import { defense, shipyard } from './yard.ts';

export const VIEWS: Record<string, (v: V) => string> = {
  overview,
  resources,
  research,
  shipyard,
  defense,
  fleet,
  galaxy,
  guilds,
  messages,
  highscore,
  achievements,
  news: (v) => `<h2>Neuigkeiten</h2>${newsHTML(v.ui.news)}`,
  help,
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
    { view: 'research', label: 'Forschung' },
    { view: 'shipyard', label: 'Schiffsschmiede' },
    { view: 'defense', label: 'Verteidigung' },
    '-',
    { view: 'fleet', label: 'Flotte' },
    { view: 'galaxy', label: 'Sternenkarte' },
    { view: 'messages', label: 'Nachrichten' },
    { view: 'highscore', label: 'Highscore' },
    { view: 'guilds', label: 'Gilden' },
  ];
  if (round.achievements || round.daily)
    items.push({
      view: 'achievements',
      label: round.achievements ? 'Achievements' : 'Tagesbelohnung',
    });
  items.push(
    '-',
    { view: 'news', label: 'Neuigkeiten' },
    { view: 'help', label: 'Hilfe & Optionen' },
  );
  if (admin) items.push({ view: 'admin', label: 'Admin' });
  return items;
}

/** Phone: four destinations in the bottom tab bar, the rest under „Mehr“ (issue #61). */
export const TAB_VIEWS = [
  'overview',
  'buildings',
  'fleet',
  'messages',
] as const;

export function phoneMenu(items: (MenuEntry | '-')[]): {
  tabs: MenuEntry[];
  more: MenuEntry[];
} {
  const entries = items.filter((i): i is MenuEntry => i !== '-');
  const isTab = (i: MenuEntry): boolean =>
    (TAB_VIEWS as readonly string[]).includes(i.view);
  return {
    tabs: TAB_VIEWS.map((v) => entries.find((i) => i.view === v)!),
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
  more: glyph(
    '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  ),
  chevron: glyph('<path d="M9 5l7 7-7 7"/>'),
};
