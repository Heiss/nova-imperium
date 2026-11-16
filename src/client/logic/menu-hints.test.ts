import { expect, it } from 'vitest';
import type { Planet } from '../../core/types.ts';
import { chatToSee, finishedYardOrders, menuHints } from './menu-hints.ts';
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

it('marks no guild applications in a round without guilds (#191)', () => {
  // The server sends no guild data while guilds are off.
  const state = {
    me: { id: 'player' },
    planet: {},
    round: { achievements: false, daily: false, guilds: false },
    achievements: { progress: {}, claimed: [], daily: null },
    fleets: [],
    guilds: null,
  } as unknown as GameState;
  expect(menuHints(state, new Map(), 0).has('guilds')).toBe(false);
});

it('marks „Gilden“ for new messages in the guild chat (#169; owner, 2026-11-15)', () => {
  const state = (
    pending: number,
    chat: { unread: boolean } | null | undefined,
  ) =>
    ({
      me: { id: 'player' },
      planet: {},
      round: { achievements: false, daily: false, guilds: true },
      achievements: { progress: {}, claimed: [], daily: null },
      fleets: [],
      guilds: {
        management: { pending: Array.from({ length: pending }, () => ({})) },
        chat,
      },
    }) as unknown as GameState;
  const hint = (s: GameState) => menuHints(s, new Map(), 0).get('guilds');
  expect(hint(state(0, { unread: true }))).toBe(
    'Neue Nachrichten im Gilden-Chat',
  );
  expect(hint(state(1, { unread: true }))).toBe(
    'Offene Gildenbewerbungen · Neue Nachrichten im Gilden-Chat',
  );
  expect(hint(state(1, { unread: false }))).toBe('Offene Gildenbewerbungen');
  expect(hint(state(0, { unread: false }))).toBeUndefined();
  // A member without a management box still gets the mark.
  const plain = state(0, { unread: true });
  plain.guilds!.management = null;
  expect(hint(plain)).toBe('Neue Nachrichten im Gilden-Chat');
  // No chat right, or an older server without the chat.
  expect(hint(state(0, null))).toBeUndefined();
  expect(hint(state(0, undefined))).toBeUndefined();
});

it('sees the chat on the page of the own guild only (#169; owner, 2026-11-15)', () => {
  const state = (over: object = {}) =>
    ({
      guilds: {
        own: { id: 'g1', status: 'member' },
        chat: {
          read: true,
          unread: true,
          messages: [{ id: 4 }, { id: 6 }, { id: 9 }],
        },
        ...over,
      },
    }) as unknown as GameState;
  expect(chatToSee(state(), 'guilds', 'g1')).toBe(9);
  // Another page, the list of guilds or another guild's page: not seen.
  expect(chatToSee(state(), 'overview', null)).toBeNull();
  expect(chatToSee(state(), 'overview', 'g1')).toBeNull();
  expect(chatToSee(state(), 'guilds', null)).toBeNull();
  expect(chatToSee(state(), 'guilds', 'g2')).toBeNull();
  // Nothing new, nothing to read, or no membership.
  const chat = (c: object) =>
    state({ chat: { read: true, unread: true, messages: [{ id: 9 }], ...c } });
  expect(chatToSee(chat({ unread: false }), 'guilds', 'g1')).toBeNull();
  expect(chatToSee(chat({ messages: [] }), 'guilds', 'g1')).toBeNull();
  expect(chatToSee(state({ chat: null }), 'guilds', 'g1')).toBeNull();
  expect(
    chatToSee(state({ own: { id: 'g1', status: 'pending' } }), 'guilds', 'g1'),
  ).toBeNull();
  expect(chatToSee(state({ own: null }), 'guilds', 'g1')).toBeNull();
  expect(
    chatToSee({ guilds: null } as unknown as GameState, 'guilds', 'g1'),
  ).toBeNull();
});
