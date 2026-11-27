// The navigation of the game (#118, bundle 1; okf/architecture/patterns.md,
// section 9): the menu, and on a phone the tab bar and the sheet „Mehr“
// (#61), each link with its address, whether it is the open view, and the
// mark of what is new there. Pure, so the components Menu.svelte,
// TabBar.svelte and MoreList.svelte only render what this module computes.
import type { Ui } from '../views/common.ts';
import { menu, MENU_HINTS, type MenuEntry, phoneMenu } from '../views/index.ts';
import { offered } from '../views/offered.ts';
import { catalogKind } from './catalog-list.ts';
import { unread } from './game.ts';
import { menuHints } from './menu-hints.ts';
import { privateUnread } from './private-messages.ts';
import { newsHint } from './news.ts';
import type { GameState } from './types.ts';

/** A link of the navigation. */
export interface NavLink extends MenuEntry {
  href: string;
  /** Whether it is the open view. */
  on: boolean;
  /** What is new there, for the mark „!“; none when nothing is. */
  hint: string | undefined;
}

export interface Navigation {
  /** The menu; '-' is a separator. */
  menu: (NavLink | '-')[];
  /** Phone: the four destinations of the tab bar. */
  tabs: NavLink[];
  /** Phone: the rest, in the sheet „Mehr“. */
  more: NavLink[];
  /** Whether the open view is under „Mehr“. */
  moreOn: boolean;
  /** Whether something under „Mehr“ is new. */
  moreHint: boolean;
  /** Phone: the bell of the header with the unread messages (#189, D1). */
  bell: { href: string; unread: number; on: boolean };
  /** The commander, for „Logout“ under „Mehr“ on a phone (#189). */
  commander: string;
}

/**
 * The navigation for the state of the server and the open view. `completed`
 * holds the views with a finished upgrade, order or flight; `href` gives the
 * address of a view.
 */
export function navigation(
  state: GameState,
  ui: Pick<Ui, 'view' | 'news' | 'newsSeen'>,
  completed: ReadonlyMap<string, string>,
  href: (view: string) => string,
): Navigation {
  // The one mark of „Nachrichten“ counts the reports and the private messages (#226).
  const fresh = unread(state.reports, state.me.readAt) + privateUnread(state);
  const hints = menuHints(MENU_HINTS, state, completed, fresh);
  const news = newsHint(ui.news, ui.newsSeen);
  if (news) hints.set('news', news);
  const link = (entry: MenuEntry): NavLink => ({
    ...entry,
    href: href(entry.view),
    on: entry.view === ui.view,
    hint: hints.get(entry.view),
  });
  const items = menu(state.me.admin, state.round);
  const { tabs, more } = phoneMenu(items);
  // „Bauen“ is open in the four lists, which its switch reaches (#189, D2).
  const building = !!catalogKind(ui.view);
  return {
    menu: items.map((i) => (i === '-' ? i : link(i))),
    tabs: tabs.map((i) => {
      const l = link(i);
      return i.view === 'buildings' && building ? { ...l, on: true } : l;
    }),
    more: more.map(link),
    moreOn: !building && more.some((i) => i.view === ui.view),
    moreHint: more.some((i) => hints.has(i.view)),
    bell: {
      href: href('messages'),
      unread: fresh,
      on: ui.view === 'messages',
    },
    commander: state.me.name,
  };
}

/** A view the player cannot open now: one that is not offered (#373); before the first state every view is open. */
export function hiddenView(view: string, state: GameState | null): boolean {
  return !!state && !offered(view, state.round, state.me.admin);
}
