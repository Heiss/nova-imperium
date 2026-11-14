// The one way of the client to send a game action (#118): the answer's state
// is applied only while the player still looks at the same planet.
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
  const act = createAct({ api, state: () => current, apply, toast });
  return {
    act,
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
    expect(await t.act('build', { key: 'metal' })).toBe(true);
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

  it('keeps the state when the player changed the planet meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(state('u1', 'p2'));
      return { state: state('u1', 'p1'), msg: 'Gebaut.' };
    });
    expect(await t.act('build')).toBe(true);
    expect(t.apply).not.toHaveBeenCalled();
    expect(t.toast).toHaveBeenCalledWith('Gebaut.');
  });

  it('keeps the state when the player signed out meanwhile', async () => {
    const t = setup(async () => {
      t.switchTo(null);
      return { state: state('u1', 'p1') };
    });
    await t.act('build');
    expect(t.apply).not.toHaveBeenCalled();
  });

  it('shows a failure as an error and answers false', async () => {
    const t = setup(async () => {
      throw new Error('Zu wenig Rohstoffe.');
    });
    expect(await t.act('build')).toBe(false);
    expect(t.toast).toHaveBeenCalledWith('Zu wenig Rohstoffe.', true);
    expect(t.apply).not.toHaveBeenCalled();
  });
});
