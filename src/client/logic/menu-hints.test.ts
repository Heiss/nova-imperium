import { expect, it } from 'vitest';
import type { Planet } from '../../shared/types.ts';
import { finishedYardOrders, menuHints } from './menu-hints.ts';
import type { GameState } from './types.ts';

it('distinguishes completed ship and defense orders in the same queue', () => {
  const planet = {
    sqT: 100,
    sq: [
      { key: 'lf', n: 2, unit: 10 },
      { key: 'rl', n: 1, unit: 40 },
    ],
  } as Planet;
  expect([...finishedYardOrders(planet, 119)]).toEqual([]);
  expect([...finishedYardOrders(planet, 120)]).toEqual(['shipyard']);
  expect([...finishedYardOrders(planet, 160)]).toEqual(['shipyard', 'defense']);
  expect(finishedYardOrders({ ...planet, sqT: null }, 500).size).toBe(0);
});

it('combines independent live hints and clears claimed rewards', () => {
  const state = {
    me: { id: 'player' },
    planet: {},
    round: { achievements: true, daily: true },
    achievements: {
      progress: { 'buildings:metal': 1 },
      claimed: [],
      daily: { claimed: false },
    },
    fleets: [{ owner: 'enemy', state: 'out' }],
    guilds: { management: { pending: [{}] } },
  } as unknown as GameState;
  expect(
    Object.fromEntries(
      menuHints(state, new Map([['fleet', 'Flotte zurückgekehrt']]), 2),
    ),
  ).toEqual({
    messages: '2 ungelesene Nachrichten',
    achievements: 'Erfolg und Tagesbelohnung abholbar',
    fleet: 'Flotte zurückgekehrt · Anfliegende Flotte',
    guilds: 'Offene Gildenbewerbungen',
  });
  state.achievements!.daily!.claimed = true;
  expect(menuHints(state, new Map(), 0).get('achievements')).toBe(
    'Erfolg abholbar',
  );
  state.achievements!.claimed = ['buildings:metal:1'];
  expect(menuHints(state, new Map(), 0).has('achievements')).toBe(false);
  state.achievements!.daily!.claimed = false;
  state.round.achievements = false;
  expect(menuHints(state, new Map(), 0).get('achievements')).toBe(
    'Tagesbelohnung abholbar',
  );
  state.planet = null;
  expect(menuHints(state, new Map(), 0).has('achievements')).toBe(false);
});
