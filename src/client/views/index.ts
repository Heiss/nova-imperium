import { achievements } from './achievements.ts';
import type { V } from './common.ts';
import { research, resources } from './economy.ts';
import { fleet } from './fleet.ts';
import { galaxy } from './galaxy.ts';
import { guilds } from './guilds.ts';
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
  help,
  admin,
};

export interface MenuEntry {
  view: string;
  label: string;
}

export function menu(admin: boolean): (MenuEntry | '-')[] {
  const items: (MenuEntry | '-')[] = [
    { view: 'overview', label: 'Übersicht' },
    { view: 'buildings', label: 'Gebäude' },
    { view: 'resources', label: 'Rohstoffe' },
    { view: 'research', label: 'Forschung' },
    { view: 'shipyard', label: 'Schiffswerft' },
    { view: 'defense', label: 'Verteidigung' },
    '-',
    { view: 'fleet', label: 'Flotte' },
    { view: 'galaxy', label: 'Galaxie' },
    { view: 'messages', label: 'Nachrichten' },
    { view: 'highscore', label: 'Highscore' },
    { view: 'guilds', label: 'Gilden' },
    { view: 'achievements', label: 'Achievements' },
    '-',
    { view: 'help', label: 'Hilfe & Optionen' },
  ];
  if (admin) items.push({ view: 'admin', label: 'Admin' });
  return items;
}
