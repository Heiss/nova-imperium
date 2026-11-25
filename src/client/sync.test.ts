// The refresh of the state names the open conversation of the private
// messages (#226, Q32), and a state of a round that switched a feature off
// sends its open view to the overview (#404); the rest of sync.ts is covered
// through logic/act.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('./api.ts', () => ({ api }));
vi.mock('./render.ts', () => ({ render: vi.fn() }));
vi.mock('./news.ts', () => ({ loadNews: vi.fn() }));
vi.mock('./toast.ts', () => ({ toast: vi.fn() }));
vi.mock('./dom.ts', async (own) => ({
  ...(await own<typeof import('./dom.ts')>()),
  $: () => ({ textContent: '' }),
}));

import { watchConversation } from './logic/private-messages.ts';
import { client } from './logic/state.svelte.ts';
import type { GameState } from './logic/types.ts';
import { render } from './render.ts';
import { apply, refresh } from './sync.ts';
import { roundDefaults } from '../test/fixtures.ts';

afterEach(() => {
  watchConversation(null);
  client.game = null;
  api.mockClear();
});

const shown = (planet = 'p1'): GameState =>
  ({
    me: { id: 'u1' },
    planet: { id: planet },
    mainPlanet: 'p1',
  }) as unknown as GameState;

describe('refresh', () => {
  it('asks for the plain state while no conversation is open', async () => {
    client.game = shown();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await refresh();
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/state');
  });

  it('names the open conversation and the newest message held (Q32)', async () => {
    client.game = shown();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    watchConversation({ name: 'Bert', after: 12 });
    await refresh();
    expect(api).toHaveBeenCalledExactlyOnceWith(
      '/api/state?pm=Bert&pmAfter=12',
    );
    api.mockClear();
    client.game = shown('p2');
    await refresh();
    expect(api).toHaveBeenCalledExactlyOnceWith(
      '/api/state?planet=p2&pm=Bert&pmAfter=12',
    );
  });
});

describe('a state of a round with a feature switched off (#404)', () => {
  const ui = client.ui;
  const before = ui.view;
  afterEach(() => {
    ui.view = before;
    client.lastKey = '';
    vi.unstubAllGlobals();
  });

  const state = (round: Record<string, unknown>): GameState =>
    ({
      ...shown(),
      me: { id: 'u1', admin: false },
      now: 0,
      round: { number: 1, ...roundDefaults(), ...round },
      cfg: { speed: 1 },
    }) as unknown as GameState;

  it('sends the open view of the feature to the overview at the next state, and keeps it while it is on', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('history', { replaceState });
    vi.stubGlobal('location', { href: 'http://nova.test/?view=market' });
    ui.view = 'market';
    apply(state({ marketOn: 1 }));
    expect(ui.view).toBe('market');
    expect(replaceState).not.toHaveBeenCalled();
    apply(state({ marketOn: 0 }));
    expect(ui.view).toBe('overview');
    expect(replaceState).toHaveBeenCalledExactlyOnceWith(
      null,
      '',
      '/?view=overview',
    );
    expect(render).toHaveBeenLastCalledWith(false);
  });
});
