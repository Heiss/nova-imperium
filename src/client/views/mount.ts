// Which views are Svelte components and how each is mounted (#114, #118):
// main.ts mounts the view of the page through `mountView` and knows no view
// by name. A view that moves from HTML to a component is added here.
import { CATALOG_VIEWS, catalogKind } from '../logic/catalog-list.ts';
import { LEXICANUM_VIEW } from '../logic/address.ts';
import { mountAchievements } from './achievements.ts';
import type { V } from './common.ts';
import { mountCatalogList } from './catalog-list.ts';
import { mountFleet } from './fleet.ts';
import { mountFriends } from './friends.ts';
import { mountGalaxy } from './galaxy.ts';
import { mountGuilds } from './guilds.ts';
import { mountHighscore } from './highscore.ts';
import { mountLexicanum } from './lexicanum.ts';
import { mountMarket } from './market.ts';
import { mountMessages } from './messages.ts';
import { mountNews } from './news.ts';
import { mountOptions } from './options.ts';
import { mountOverview } from './overview.ts';
import { mountProducerTable } from './producer-table.ts';

/** A mounted Svelte view: its name, its update (a list follows the state) and how to take it down. */
export interface Mounted {
  view: string;
  update?: (v: V) => void;
  destroy: () => void;
}

/** What mounts the view of a name; the four lists are mounted by their kind. */
const MOUNT: Record<
  string,
  (target: HTMLElement, v: V) => Omit<Mounted, 'view'>
> = {
  overview: mountOverview,
  resources: mountProducerTable,
  galaxy: mountGalaxy,
  fleet: mountFleet,
  news: mountNews,
  messages: mountMessages,
  highscore: mountHighscore,
  achievements: mountAchievements,
  help: mountOptions,
  guilds: mountGuilds,
  market: mountMarket,
  friends: mountFriends,
  [LEXICANUM_VIEW]: mountLexicanum,
};

/** The views that are Svelte components. */
export const MOUNTED: ReadonlySet<string> = new Set([
  ...Object.keys(MOUNT),
  ...Object.keys(CATALOG_VIEWS),
]);

/** The Svelte views mounted anew on every render, as their HTML was rendered anew (#118). */
export const ANEW: ReadonlySet<string> = new Set([
  'overview',
  'galaxy',
  'fleet',
  'news',
  'messages',
  'highscore',
  'achievements',
  'help',
  'guilds',
  'market',
  'friends',
]);

/** Mounts the component of the view; any other view gets the overview. */
export function mountView(view: string, target: HTMLElement, v: V): Mounted {
  const kind = catalogKind(view);
  if (kind) return { view, ...mountCatalogList(target, kind) };
  const known = Object.hasOwn(MOUNT, view);
  const name = known ? view : 'overview';
  return { view: name, ...MOUNT[name]!(target, v) };
}
