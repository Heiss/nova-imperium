// The one way of the client to send a game action (#118): the answer's state
// is applied only while the player still looks at the same planet, and a
// refresh never applies a state older than an action's answer (review of
// #209).
import { describe, expect, it, vi } from 'vitest';
import { type ActDeps, createAct, placeOf, samePlace } from './act.ts';
import type { GameState } from './types.ts';

const state = (player: string, planet: string | null): GameState =>
  ({
    me: { id: player },
    planet: planet === null ? null : { id: planet },
  }) as unknown as GameState;

function setup(answer: () => Promise<Record<string, unknown>>) {
  let current: GameState | null = state('u1', 'p1');
  const api = vi.fn<ActDeps['api']>(() => answer());
  const apply = vi.fn();
  const toast = vi.fn();
  const sync = createAct({ api, state: () => current, apply, toast });
  return {
    act: sync.send,
    refresh: sync.refresh,
    api,
    apply,
    toast,
    switchTo: (next: GameState | null) => (current = next),
  };
}

describe('placeOf and samePlace', () => {
  it('names the player and the planet of a state', () => {
    expect(placeOf(state('u1', 'p1'))).toEqual({
      player: 'u1',
      planet: 'p1',
    });
    expect(placeOf(state('u1', null))).toEqual({
      player: 'u1',
      planet: undefined,
    });
    expect(placeOf(null)).toEqual({ player: undefined, planet: undefined });
  });

  it('is the same place only for the same player and planet', () => {
    const here = { player: 'u1', planet: 'p1' };
    expect(samePlace(state('u1', 'p1'), here)).toBe(true);
    expect(samePlace(state('u2', 'p1'), here)).toBe(false);
    expect(samePlace(state('u1', 'p2'), here)).toBe(false);
    expect(samePlace(null, here)).toBe(false);
    expect(samePlace(null, {})).toBe(false);
    expect(samePlace(state('u1', null), { player: 'u1' })).toBe(true);
  });
});

describe('act', () => {
  it('posts the action with the planet and applies the answer', async () => {
    const next = state('u1', 'p1');
    const t = setup(async () => ({ state: next }));
    expect(await t.act('build', { key: 'metal' })).toBe('done');
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'build',
      planet: 'p1',
      key: 'metal',
    });
    expect(t.apply).toHaveBeenCalledWith(next);
    expect(t.toast).not.toHaveBeenCalled();
  });

  it('sends no data but the type and the planet by default', async () => {
    const t = setup(async () => ({}));
    await t.act('cancelBuild');
    expect(t.api).toHaveBeenCalledWith('/api/action', {
      type: 'cancelBuild',
      planet: 'p1',
    });
  });

  it('shows the message of the server', async () => {
    const t = setup(async () => ({ state: state('u1', 'p1'), msg: 'Gebaut.' }));
    await t.act('build');
    expect(t.toast).toHaveBeenCalledWith('Gebaut.');
  });

  it('answers stale and keeps the state when the player changed the planet meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(state('u1', 'p2'));
      return { state: state('u1', 'p1'), msg: 'Gebaut.' };
    });
    // The order went through on p1, but the form of p2 must stay (#209).
    expect(await t.act('order')).toBe('stale');
    expect(t.apply).not.toHaveBeenCalled();
    expect(t.toast).toHaveBeenCalledWith('Gebaut.');
  });

  it('answers stale when the player signed out meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(null);
      return { state: state('u1', 'p1') };
    });
    expect(await t.act('build')).toBe('stale');
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('shows a failure as an error and answers failed', async () => {
    const t = setup(async () => {
      throw new Error('Zu wenig Rohstoffe.');
    });
    expect(await t.act('build')).toBe('failed');
    expect(t.toast).toHaveBeenCalledWith('Zu wenig Rohstoffe.', true);
    expect(t.apply).not.toHaveBeenCalled();
  });
});

describe('a refresh', () => {
  /** An answer of the server that the test sends when it likes. */
  function later() {
    let send: (j: Record<string, unknown>) => void = () => undefined;
    let fail: (e: Error) => void = () => undefined;
    const answer = new Promise<Record<string, unknown>>((ok, no) => {
      send = ok;
      fail = no;
    });
    return { answer, send: () => send({}), fail: () => fail(new Error('x')) };
  }

  it('may apply its state when no action ran meanwhile', () => {
    const t = setup(async () => ({}));
    expect(t.refresh()()).toBe(true);
  });

  it('may apply its state after an action that ended before it started', async () => {
    const t = setup(async () => ({}));
    await t.act('build');
    expect(t.refresh()()).toBe(true);
  });

  it('only the newest refresh applies its state', () => {
    const t = setup(async () => ({}));
    const first = t.refresh();
    const second = t.refresh();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it('drops its state when an action started meanwhile', async () => {
    const t = setup(async () => ({}));
    const fresh = t.refresh();
    await t.act('build');
    expect(fresh()).toBe(false);
    expect(t.refresh()()).toBe(true);
  });

  it('drops its state when it started while an action was on its way', async () => {
    const pending = later();
    const t = setup(() => pending.answer);
    const action = t.act('build');
    const fresh = t.refresh();
    expect(fresh()).toBe(false);
    pending.send();
    expect(await action).toBe('done');
    expect(fresh()).toBe(false);
    expect(t.refresh()()).toBe(true);
  });

  it('counts a failed action as over', async () => {
    const pending = later();
    const t = setup(() => pending.answer);
    const action = t.act('build');
    expect(t.refresh()()).toBe(false);
    pending.fail();
    expect(await action).toBe('failed');
    expect(t.refresh()()).toBe(true);
  });

  it('waits until every action is over', async () => {
    const one = later();
    const two = later();
    const answers = [one.answer, two.answer];
    const t = setup(() => answers.shift()!);
    const first = t.act('build');
    const second = t.act('research');
    one.send();
    await first;
    expect(t.refresh()()).toBe(false);
    two.send();
    await second;
    expect(t.refresh()()).toBe(true);
  });
});
