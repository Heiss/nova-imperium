// The refresh of the state names the open conversation of the private
// messages (#226, Q32); the rest of sync.ts is covered through logic/act.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('./api.ts', () => ({ api }));
vi.mock('./render.ts', () => ({ render: vi.fn() }));
vi.mock('./news.ts', () => ({ loadNews: vi.fn() }));
vi.mock('./toast.ts', () => ({ toast: vi.fn() }));

import { watchConversation } from './logic/private-messages.ts';
import { client } from './logic/state.svelte.ts';
import type { GameState } from './logic/types.ts';
import { refresh } from './sync.ts';

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
