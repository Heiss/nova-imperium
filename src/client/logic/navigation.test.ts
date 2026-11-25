// The navigation (#118, bundle 1): the menu, the tab bar and „Mehr“ of the
// phone, each link with its address, the open view and the mark of what is
// new there.
import { describe, expect, it } from 'vitest';
import { hiddenView, navigation, type NavLink } from './navigation.ts';
import type { NewsData } from './news.ts';
import type { GameState } from './types.ts';

// The marketplace on: its view is offered only then (#404).
const round = { achievements: false, daily: false, guilds: true, marketOn: 1 };

const state = (over: object = {}, me: object = {}): GameState =>
  ({
    me: { id: 'u1', admin: false, readAt: 100, ...me },
    planet: {},
    round,
    reports: [],
    fleets: [],
    ...over,
  }) as unknown as GameState;

const NEWS: NewsData = {
  version: '1.2.0',
  versions: [{ version: '1.2.0', date: '2026-11-16', entries: [] }],
};

const href = (view: string): string => `/?view=${view}`;

const nav = (
  s: GameState,
  view = 'overview',
  completed: Map<string, string> = new Map(),
  news: NewsData | null = null,
  newsSeen: string | null = null,
) => navigation(s, { view, news, newsSeen }, completed, href);

const views = (links: (NavLink | '-')[]): string[] =>
  links.map((l) => (l === '-' ? '-' : l.view));

describe('navigation', () => {
  it('lists the menu with its separators, the tab bar and „Mehr“', () => {
    const n = nav(state());
    expect(views(n.menu)).toEqual([
      'overview',
      'buildings',
      'resources',
      'market',
      'research',
      'shipyard',
      'defense',
      '-',
      'fleet',
      'galaxy',
      'messages',
      'highscore',
      'guilds',
      'friends',
      '-',
      'news',
      'lexicanum',
      'help',
    ]);
    // #189 (D1): Übersicht, Bauen, Flotte, Karte; the messages are the bell.
    expect(views(n.tabs)).toEqual(['overview', 'buildings', 'fleet', 'galaxy']);
    expect(n.tabs.map((l) => l.label)).toEqual([
      'Übersicht',
      'Bauen',
      'Flotte',
      'Sternenkarte',
    ]);
    expect(views(n.more)).toEqual([
      'resources',
      'market',
      'research',
      'shipyard',
      'defense',
      'messages',
      'highscore',
      'guilds',
      'friends',
      'news',
      'lexicanum',
      'help',
    ]);
  });

  it('gives each link its label, its address and whether it is open', () => {
    const n = nav(state(), 'buildings');
    expect(n.tabs[0]).toEqual({
      view: 'overview',
      label: 'Übersicht',
      href: '/?view=overview',
      on: false,
      hint: undefined,
    });
    expect(n.tabs[1]).toMatchObject({ view: 'buildings', on: true });
    expect(n.menu.filter((l) => l !== '-' && l.on)).toHaveLength(1);
  });

  it('shows the admin entry to an admin only, under „Mehr“', () => {
    expect(views(nav(state({}, { admin: true })).more).at(-1)).toBe('admin');
    expect(views(nav(state()).menu)).not.toContain('admin');
  });

  it('marks „Mehr“ while one of its views is open', () => {
    expect(nav(state(), 'highscore').moreOn).toBe(true);
    expect(nav(state(), 'fleet').moreOn).toBe(false);
    expect(nav(state(), 'galaxy').moreOn).toBe(false);
  });

  it('marks „Bauen“, not „Mehr“, in each of the four lists (#189, D2)', () => {
    for (const view of ['buildings', 'research', 'shipyard', 'defense']) {
      const n = nav(state(), view);
      expect(n.tabs.filter((l) => l.on).map((l) => l.view)).toEqual([
        'buildings',
      ]);
      expect(n.moreOn).toBe(false);
      // The menu of the desktop marks the open list only.
      expect(n.menu.filter((l) => l !== '-' && l.on)).toHaveLength(1);
    }
    expect(nav(state(), 'resources').tabs.some((l) => l.on)).toBe(false);
  });

  it('gives the bell the unread messages and the commander for „Logout“ (#189, D1)', () => {
    const s = state({ reports: [{ time: 100 }, { time: 101 }, { time: 102 }] });
    expect(nav(s).bell).toEqual({
      href: '/?view=messages',
      unread: 2,
      on: false,
    });
    expect(nav(state(), 'messages').bell).toMatchObject({
      unread: 0,
      on: true,
    });
    expect(nav(state({}, { name: 'Kai' })).commander).toBe('Kai');
  });

  it('marks what finished, the unread messages and the news', () => {
    const s = state({ reports: [{ time: 100 }, { time: 101 }] });
    const n = nav(s, 'overview', new Map([['research', 'Forschung fertig']]));
    const messages = (l: ReturnType<typeof nav>) =>
      l.more.find((x) => x.view === 'messages')!;
    expect(messages(n).hint).toBe('1 ungelesene Nachrichten');
    expect(n.more[2]!.hint).toBe('Forschung fertig');
    expect(n.moreHint).toBe(true);
    expect(messages(nav(state({ reports: [{ time: 100 }] }))).hint).toBe(
      undefined,
    );
  });

  it('counts the unread private messages in the one mark of „Nachrichten“ and in the bell (#226)', () => {
    const own = (unread: number) => ({
      privateMessages: {
        friendsOnly: false,
        blocked: [],
        conversations: [{ with: 'Bert', unread, messages: [] }],
      },
    });
    const messages = (l: ReturnType<typeof nav>) =>
      l.more.find((x) => x.view === 'messages')!;
    const s = state({ reports: [{ time: 100 }, { time: 101 }], ...own(3) });
    expect(messages(nav(s)).hint).toBe('4 ungelesene Nachrichten');
    expect(nav(s).bell.unread).toBe(4);
    expect(messages(nav(state(own(2)))).hint).toBe('2 ungelesene Nachrichten');
    expect(messages(nav(state(own(0)))).hint).toBe(undefined);
  });

  it('marks „Mehr“ only for something new under it', () => {
    // The unread messages are under „Mehr“ now, next to the bell (#189).
    const s = state({ reports: [{ time: 101 }] });
    expect(nav(s).moreHint).toBe(true);
    expect(nav(state()).moreHint).toBe(false);
  });

  it('marks the news until their newest version was seen', () => {
    const news = nav(state(), 'overview', new Map(), NEWS);
    expect(news.more.find((l) => l.view === 'news')!.hint).toBe(
      'Neu in Version 1.2.0',
    );
    expect(news.moreHint).toBe(true);
    const seen = nav(state(), 'overview', new Map(), NEWS, '1.2.0');
    expect(seen.more.find((l) => l.view === 'news')!.hint).toBe(undefined);
    expect(seen.moreHint).toBe(false);
  });
});

describe('the views a player cannot open (moved from main.ts for #78)', () => {
  const rules = (over: object): GameState =>
    state({ round: { ...round, ...over } });

  it('hides the admin view from a player but not from the admin', () => {
    expect(hiddenView('admin', state())).toBe(true);
    expect(hiddenView('admin', state({}, { admin: true }))).toBe(false);
    expect(hiddenView('admin', null)).toBe(false);
  });

  it('hides the rewards only when achievements and daily rewards are off', () => {
    expect(hiddenView('achievements', rules({}))).toBe(true);
    expect(hiddenView('achievements', rules({ achievements: true }))).toBe(
      false,
    );
    expect(hiddenView('achievements', rules({ daily: true }))).toBe(false);
    expect(hiddenView('achievements', null)).toBe(false);
  });

  it('hides the guilds in a round without guilds (#191)', () => {
    expect(hiddenView('guilds', rules({ guilds: false }))).toBe(true);
    expect(hiddenView('guilds', rules({ guilds: true }))).toBe(false);
    expect(hiddenView('guilds', null)).toBe(false);
  });

  it('hides no other view', () => {
    const off = rules({ guilds: false });
    for (const view of ['overview', 'highscore', 'unknown'])
      expect(hiddenView(view, off)).toBe(false);
  });
});
