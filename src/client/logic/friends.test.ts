// The buddy list in the browser (#227): what each friend shows (name, guild
// tag, the planet on the Sternenkarte, online or offline; owner, 2026-11-16,
// D1), the requests, the mark on „Freunde“ and the action of each button.
import { describe, expect, it } from 'vitest';
import {
  FRIEND_END,
  buddyList,
  friendCall,
  friendsHint,
  homePlanetOf,
} from './friends.ts';
import type { GalaxyPlanet, GameState } from './types.ts';

const at = (owner: string, kind: 'planet' | 'moon', p: number) =>
  ({
    id: `${kind[0]}1_2_${p}`,
    kind,
    name: `${owner} ${kind}`,
    g: 1,
    s: 2,
    p,
    temp: 20,
    owner,
  }) as GalaxyPlanet;

const galaxy = [at('u_Bert', 'moon', 4), at('u_Bert', 'planet', 4)];

function state(over: Partial<GameState> = {}): GameState {
  return {
    me: { id: 'u_Anna' },
    players: {
      u_Anna: { name: 'Anna', points: 1 },
      u_Bert: { name: 'Bert', points: 2 },
      u_Cora: { name: 'Cora', points: 3 },
      u_Dora: { name: '<b>Dora</b>', points: 4 },
    },
    galaxy,
    guilds: {
      directory: [
        { id: 'g1', tag: 'ABC', members: [{ id: 'u_Bert' }] },
        { id: 'g2', tag: 'XYZ', members: [{ id: 'u_Anna' }] },
      ],
    },
    friends: {
      list: [
        { id: 'u_Bert', online: true },
        { id: 'u_Cora', online: false },
      ],
      incoming: ['u_Dora'],
      outgoing: ['u_Cora'],
    },
    ...over,
  } as unknown as GameState;
}

describe('the buddy list', () => {
  it('shows each friend with name, guild tag, planet and online or offline', () => {
    expect(buddyList(state())).toEqual({
      list: [
        {
          id: 'u_Bert',
          name: 'Bert',
          tag: 'ABC',
          home: galaxy[1],
          online: true,
        },
        { id: 'u_Cora', name: 'Cora', tag: null, home: null, online: false },
      ],
      incoming: [{ id: 'u_Dora', name: '<b>Dora</b>' }],
      outgoing: [{ id: 'u_Cora', name: 'Cora' }],
    });
  });

  it('shows no guild tag while guilds are off', () => {
    expect(buddyList(state({ guilds: null })).list[0]!.tag).toBeNull();
  });

  it('is empty without the buddy list in the state', () => {
    expect(buddyList(state({ friends: undefined }))).toEqual({
      list: [],
      incoming: [],
      outgoing: [],
    });
  });

  it('takes an empty name for a player missing from the state', () => {
    const s = state();
    s.friends!.incoming = ['u_Gone'];
    expect(buddyList(s).incoming).toEqual([{ id: 'u_Gone', name: '' }]);
  });

  it('names a planet of a player, never a moon, as the Highscore does', () => {
    expect(homePlanetOf(galaxy, 'u_Bert')).toBe(galaxy[1]);
    expect(homePlanetOf(galaxy, 'u_Anna')).toBeNull();
  });
});

describe('the mark on „Freunde“', () => {
  it('names open requests to the player only', () => {
    expect(friendsHint(state())).toBe('Offene Freundschaftsanfragen');
    const s = state();
    s.friends!.incoming = [];
    expect(friendsHint(s)).toBe('');
    expect(friendsHint(state({ friends: undefined }))).toBe('');
  });
});

describe('the buttons of the buddy list', () => {
  const yes = () => true;
  const no = () => false;

  it('requests by the typed name, trimmed, and sends nothing without one', () => {
    expect(friendCall({ op: 'request' }, ' Bert ', no)).toEqual([
      'requestFriend',
      { name: 'Bert' },
    ]);
    expect(friendCall({ op: 'request' }, '  ', yes)).toBeNull();
  });

  it('accepts, refuses and cancels a request of a player', () => {
    expect(friendCall({ op: 'accept', uid: 'u_B' }, '', no)).toEqual([
      'answerFriend',
      { uid: 'u_B', accept: true },
    ]);
    expect(friendCall({ op: 'refuse', uid: 'u_B' }, '', no)).toEqual([
      'answerFriend',
      { uid: 'u_B', accept: false },
    ]);
    expect(friendCall({ op: 'cancel', uid: 'u_B' }, '', no)).toEqual([
      'cancelFriend',
      { uid: 'u_B' },
    ]);
  });

  it('ends a friendship only after the question', () => {
    const asked: string[] = [];
    const ask = (answer: boolean) => (q: string) => {
      asked.push(q);
      return answer;
    };
    expect(friendCall({ op: 'remove', uid: 'u_B' }, '', ask(false))).toBe(null);
    expect(friendCall({ op: 'remove', uid: 'u_B' }, '', ask(true))).toEqual([
      'removeFriend',
      { uid: 'u_B' },
    ]);
    expect(asked).toEqual([FRIEND_END, FRIEND_END]);
    expect(FRIEND_END).toBe('Freundschaft beenden?');
  });

  it('does nothing for an unknown button', () => {
    expect(friendCall({ op: 'block', uid: 'u_B' }, 'x', yes)).toBeNull();
    expect(friendCall({}, 'x', yes)).toBeNull();
  });
});
