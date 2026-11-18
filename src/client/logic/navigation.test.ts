// The navigation (#118, bundle 1): the menu, the tab bar and „Mehr“ of the
// phone, each link with its address, the open view and the mark of what is
// new there.
import { describe, expect, it } from 'vitest';
import { navigation, type NavLink } from './navigation.ts';
import type { NewsData } from './news.ts';
import type { GameState } from './types.ts';

const round = { achievements: false, daily: false, guilds: true };

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
    expect(views(n.tabs)).toEqual([
      'overview',
      'buildings',
      'fleet',
      'messages',
    ]);
    expect(views(n.more)).toEqual([
      'resources',
      'research',
      'shipyard',
      'defense',
      'galaxy',
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
    expect(nav(state(), 'galaxy').moreOn).toBe(true);
    expect(nav(state(), 'fleet').moreOn).toBe(false);
  });

  it('marks what finished, the unread messages and the news', () => {
    const s = state({ reports: [{ time: 100 }, { time: 101 }] });
    const n = nav(s, 'overview', new Map([['research', 'Forschung fertig']]));
    expect(n.tabs[3]!.hint).toBe('1 ungelesene Nachrichten');
    expect(n.more[1]!.hint).toBe('Forschung fertig');
    expect(n.moreHint).toBe(true);
    expect(nav(state({ reports: [{ time: 100 }] })).tabs[3]!.hint).toBe(
      undefined,
    );
  });

  it('marks „Mehr“ only for something new under it', () => {
    const s = state({ reports: [{ time: 101 }] });
    expect(nav(s).moreHint).toBe(false);
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
