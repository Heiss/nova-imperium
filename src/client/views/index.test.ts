import { describe, expect, it } from 'vitest';
import { menu, phoneMenu, TAB_GLYPHS, TAB_VIEWS } from './index.ts';

const round = { achievements: true, daily: false } as Parameters<
  typeof menu
>[1];

describe('phone menu', () => {
  it('puts four destinations in the tab bar and the rest under „Mehr“', () => {
    const { tabs, more } = phoneMenu(menu(false, round));
    expect(tabs.map((t) => t.view)).toEqual([...TAB_VIEWS]);
    expect(tabs.map((t) => t.label)).toEqual([
      'Übersicht',
      'Gebäude',
      'Flotte',
      'Nachrichten',
    ]);
    expect(more.map((t) => t.view)).toEqual([
      'resources',
      'research',
      'shipyard',
      'defense',
      'galaxy',
      'highscore',
      'guilds',
      'achievements',
      'news',
      'help',
    ]);
  });
  it('keeps the admin entry under „Mehr“', () => {
    const { more } = phoneMenu(menu(true, round));
    expect(more.at(-1)).toEqual({ view: 'admin', label: 'Admin' });
  });
  it('has a glyph for every tab and for „Mehr“', () => {
    for (const v of [...TAB_VIEWS, 'more', 'chevron'])
      expect(TAB_GLYPHS[v]).toMatch(/^<svg [^>]*aria-hidden="true"/);
  });
});
