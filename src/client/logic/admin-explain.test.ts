// The explanation of a setting as the panel shows it (#358).
import { describe, expect, it } from 'vitest';
import { explainedSettings, explainTable } from '../../core/admin-explain.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import {
  EXPLAIN_PANEL_ID,
  explainButtonId,
  explainPage,
  openedAt,
} from './admin-explain.ts';
import type { GameState } from './types.ts';

const s = {
  cfg: DEFAULT_UNIVERSE,
  round: roundDefaults(),
} as unknown as Pick<GameState, 'cfg' | 'round'>;

describe('the explanation of a setting (#358)', () => {
  it('has the label, the text and the table of its registry entry', () => {
    const speed = explainedSettings().find((x) => x.key === 'speed')!;
    const page = explainPage('speed', s)!;
    expect(page.key).toBe('speed');
    expect(page.label).toBe(speed.label);
    expect(page.text).toBe(speed.explain!.text);
    const table = explainTable(speed, s.cfg, s.round)!;
    expect(page.table).toEqual({
      head: table.head,
      rows: table.rows.map((r) => r.cells.map(String)),
    });
  });

  it('has no table for a setting that has none, and is none for an unknown key', () => {
    expect(explainPage('galaxies', s)).toMatchObject({ table: null });
    expect(explainPage('roundGuilds', s)?.text).toMatch(/Gilden/);
    expect(explainPage('nope', s)).toBeNull();
  });

  it('names the panel and each „?“ apart in the tab and in the dialog', () => {
    expect(EXPLAIN_PANEL_ID).toBe('admin-explain-panel');
    expect(explainButtonId('speed', 'u')).toBe('axqu_speed');
    expect(explainButtonId('speed', 'r')).toBe('axqr_speed');
  });

  it('knows where a „?“ stands, and none for no „?“ (PR #471)', () => {
    expect(openedAt('axqu_speed', 'u')).toBe(true);
    expect(openedAt('axqu_speed', 'r')).toBe(false);
    expect(openedAt('axqr_roundGuilds', 'r')).toBe(true);
    expect(openedAt('x_axqr_roundGuilds', 'r')).toBe(false);
    expect(openedAt(null, 'u')).toBe(false);
  });
});
