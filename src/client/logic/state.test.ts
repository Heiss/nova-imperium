// The state module of the client (#118): one state with runes that the views
// read; main.ts keeps no copy of it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from './types.ts';
import { client, newUi } from './state.svelte.ts';
import type { V } from '../views/common.ts';

afterEach(() => vi.useRealTimers());

describe('the client state', () => {
  it('starts signed out on the overview', () => {
    expect(client.game).toBeNull();
    expect(client.shown).toBeNull();
    expect(client.view).toBeNull();
    expect(client.offset).toBe(0);
    expect(client.lastKey).toBe('');
    expect(client.ui).toEqual(newUi());
  });

  it('has the interface state of a fresh page', () => {
    expect(newUi()).toEqual({
      view: 'overview',
      guild: null,
      gal: 1,
      sys: 1,
      ft: null,
      gmoon: null,
      fm: 'attack',
      openRep: {},
      openEx: {},
      auth: null,
      invite: null,
      lastLink: null,
      animations: true,
      news: null,
      newsSeen: null,
    });
    expect(newUi().openEx).not.toBe(newUi().openEx);
  });

  it('keeps the state of the server and the view', () => {
    const game = { now: 5 } as unknown as GameState;
    const view = { now: 5 } as unknown as V;
    client.game = game;
    client.shown = view;
    expect(client.game).toBe(game);
    expect(client.shown).toBe(view);
    client.game = null;
    client.shown = null;
  });

  it('tells the time of the server', () => {
    vi.useFakeTimers({ now: 10_000 });
    client.offset = 2500;
    expect(client.now()).toBe(12_500);
    client.offset = -500;
    expect(client.now()).toBe(9500);
    client.offset = 0;
  });

  it('forgets the notices and the view of another planet', () => {
    client.view = { now: 1 } as unknown as V;
    client.completedMenu.set('buildings', 'Ausbau fertig');
    client.completionNotices.add('Ausbau fertig: Mine (Stufe 2).');
    client.forget();
    expect(client.view).toBeNull();
    expect(client.completedMenu.size).toBe(0);
    expect(client.completionNotices.size).toBe(0);
  });
});
