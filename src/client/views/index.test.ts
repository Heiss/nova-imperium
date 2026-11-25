import { describe, expect, it } from 'vitest';
import { menu, phoneMenu, TAB_GLYPHS, TAB_VIEWS } from './index.ts';

// Every switch of a feature on but the daily reward; the marketplace is on
// too, its view is offered only then (#404).
const round = {
  achievements: true,
  daily: false,
  guilds: true,
  marketOn: 1,
} as Parameters<typeof menu>[1];

describe('phone menu', () => {
  it('puts four destinations in the tab bar and the rest under „Mehr“ (#189, D1)', () => {
    const { tabs, more } = phoneMenu(menu(false, round));
    expect(tabs.map((t) => t.view)).toEqual([...TAB_VIEWS]);
    expect(tabs.map((t) => t.label)).toEqual([
      'Übersicht',
      'Bauen',
      'Flotte',
      'Sternenkarte',
    ]);
    expect(more.map((t) => t.view)).toEqual([
      'resources',
      'market',
      'research',
      'shipyard',
      'defense',
      'messages',
      'highscore',
      'guilds',
      'friends',
      'achievements',
      'news',
      'lexicanum',
      'help',
    ]);
  });
  it('has no „Gilden“ in a round without guilds (#191)', () => {
    const off = { ...round, guilds: false };
    const views = (items: ReturnType<typeof menu>) =>
      items.flatMap((i) => (i === '-' ? [] : [i.view]));
    expect(views(menu(false, round))).toContain('guilds');
    expect(views(menu(false, off))).not.toContain('guilds');
    expect(views(menu(true, off))).not.toContain('guilds');
    // The buddy list stays with guilds off (#227).
    expect(views(menu(false, off))).toContain('friends');
    expect(phoneMenu(menu(false, off)).more.map((t) => t.view)).toEqual([
      'resources',
      'market',
      'research',
      'shipyard',
      'defense',
      'messages',
      'highscore',
      'friends',
      'achievements',
      'news',
      'lexicanum',
      'help',
    ]);
  });
  it('keeps the admin entry under „Mehr“', () => {
    const { more } = phoneMenu(menu(true, round));
    expect(more.at(-1)).toEqual({ view: 'admin', label: 'Admin' });
  });
  it('has a glyph for every tab and for „Mehr“', () => {
    for (const v of [...TAB_VIEWS, 'more', 'chevron', 'bell'])
      expect(TAB_GLYPHS[v]).toMatch(/^<svg [^>]*aria-hidden="true"/);
  });
});
