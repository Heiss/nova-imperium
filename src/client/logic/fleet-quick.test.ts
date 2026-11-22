// The list „Schnellwahl“ with friends, guild members and last targets (#292;
// owner, 2026-11-17): one flat list, own places first, then the friends, the
// guild members and the last targets, each foreign entry with its word.
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { quickTargets } from './fleet-target.ts';
import type { GameState } from './types.ts';

const place = (
  id: string,
  kind: 'planet' | 'moon',
  name: string,
  g: number,
  s: number,
  p: number,
  owner: string,
) => ({ id, kind, name, g, s, p, temp: 1, owner });

const state = (quick?: GameState['quick']): GameState =>
  ({
    cfg: U,
    me: { id: 'u1' },
    players: {
      u1: { name: 'Anna', points: 1 },
      u2: { name: 'Bert <b>', points: 1 },
      u3: { name: 'Cora', points: 1 },
    },
    galaxy: [
      place('p1_1_5', 'planet', 'Heimat', 1, 1, 5, 'u1'),
      place('p1_1_9', 'planet', 'Kolonie', 1, 1, 9, 'u1'),
      place('p1_2_6', 'planet', 'Beta', 1, 2, 6, 'u2'),
      place('m1_2_6', 'moon', 'Luna', 1, 2, 6, 'u2'),
      place('p1_3_7', 'planet', 'Gamma', 1, 3, 7, 'u3'),
    ],
    quick,
  }) as unknown as GameState;

describe('the list „Schnellwahl“ of friends, guild and last targets', () => {
  it('is the own places, the friends, the guild members and the last targets in this order, in one list', () => {
    const s = state({
      friends: ['p1_2_6'],
      guild: ['p1_3_7'],
      last: ['m1_2_6', 'p1_3_7'],
    });
    expect(quickTargets(s, 'p1_1_5')).toEqual([
      { id: 'p1_1_9', label: 'Kolonie [1:1:9]' },
      { id: 'p1_2_6', label: 'Freund: Bert <b> [1:2:6]' },
      { id: 'p1_3_7', label: 'Gilde: Cora [1:3:7]' },
      { id: 'm1_2_6', label: 'Ziel: Bert <b> – Luna (Mond) [1:2:6]' },
    ]);
  });

  it('lists a place once, under the first group that has it, whatever the server sends (#362)', () => {
    const s = state({
      friends: ['p1_2_6'],
      guild: ['p1_2_6', 'p1_3_7'],
      last: ['p1_2_6', 'p1_3_7', 'p1_1_9', 'm1_2_6', 'm1_2_6'],
    });
    expect(quickTargets(s, 'p1_1_5')).toEqual([
      { id: 'p1_1_9', label: 'Kolonie [1:1:9]' },
      { id: 'p1_2_6', label: 'Freund: Bert <b> [1:2:6]' },
      { id: 'p1_3_7', label: 'Gilde: Cora [1:3:7]' },
      { id: 'm1_2_6', label: 'Ziel: Bert <b> – Luna (Mond) [1:2:6]' },
    ]);
  });

  it('keeps the own places without a prefix and only the own ones when the server sends nothing', () => {
    expect(quickTargets(state(), 'p1_1_9')).toEqual([
      { id: 'p1_1_5', label: 'Heimat [1:1:5]' },
    ]);
    expect(
      quickTargets(state({ friends: [], guild: [], last: [] }), 'p1_1_9'),
    ).toEqual([{ id: 'p1_1_5', label: 'Heimat [1:1:5]' }]);
  });

  it('leaves out a place the galaxy does not list', () => {
    const s = state({ friends: ['p9_9_9'], guild: [], last: ['p9_9_8'] });
    expect(quickTargets(s, 'p1_1_5').map((q) => q.id)).toEqual(['p1_1_9']);
  });
});
