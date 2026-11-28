// The side panel of the explanations as it renders (#358): nothing while
// none is open, else the label, the text and the table of the setting.
import { render } from 'svelte/server';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { explainButtonId, explainPage } from '../logic/admin-explain.ts';
import { client } from '../logic/state.svelte.ts';
import type { GameState } from '../logic/types.ts';
import { adminExplain } from './admin-explain-state.svelte.ts';
import AdminExplainPanel from './AdminExplainPanel.svelte';

const game = {
  cfg: DEFAULT_UNIVERSE,
  round: roundDefaults(),
} as unknown as GameState;

afterEach(() => {
  adminExplain.key = null;
  adminExplain.opener = null;
  client.game = null;
});

const body = (place: 'u' | 'r' = 'u'): string =>
  render(AdminExplainPanel, { props: { place } }).body;

/** Opens the explanation of `key` from its „?“ at `place`. */
const open = (key: string, place: 'u' | 'r' = 'u'): void => {
  adminExplain.key = key;
  adminExplain.opener = explainButtonId(key, place);
};

describe('the panel of the explanations (#358)', () => {
  it('shows nothing while no explanation is open, or without a state', () => {
    client.game = game;
    expect(body()).not.toContain('<aside');
    open('speed');
    client.game = null;
    expect(body()).not.toContain('<aside');
  });

  it('shows the label, the text and every cell of the table', () => {
    client.game = game;
    open('speed');
    const html = body();
    const page = explainPage('speed', game)!;
    expect(html).toContain('id="admin-explain-panel"');
    expect(html).toContain(page.label);
    expect(html).toContain(page.text);
    for (const cell of [...page.table!.head, ...page.table!.rows.flat()])
      expect(html).toContain(`>${cell}</`);
    expect(html).toContain('Schließen');
  });

  it('shows a setting without a table as text only', () => {
    client.game = game;
    open('galaxies');
    const html = body();
    expect(html).toContain(explainPage('galaxies', game)!.text);
    expect(html).not.toContain('<table');
  });

  it('shows only what was opened at its place: the tab „Universum“ or the dialog „Neue Runde“ (PR #471)', () => {
    client.game = game;
    open('roundGuilds', 'r');
    expect(body('u')).not.toContain('<aside');
    expect(body('r')).toContain(explainPage('roundGuilds', game)!.text);
    open('speed', 'u');
    expect(body('r')).not.toContain('<aside');
    expect(body('u')).toContain('id="admin-explain-panel"');
  });
});
