// What the Lexicanum reads of the player's own state (#288, #289).
import { describe, expect, it } from 'vitest';
import { planet, roundDefaults, U } from '../../test/fixtures.ts';
import type { Ui, V } from '../views/common.ts';
import { ownState } from './lexicanum-own.ts';
import type { GameState } from './types.ts';

const view = (): V => {
  const here = planet({ id: 'p1_1_5' });
  return {
    s: {
      cfg: U,
      round: { number: 1, ...roundDefaults() },
      me: { id: 'u1' },
      players: {
        u1: { name: 'Ich', points: 40 },
        u2: { name: 'Er', points: 900 },
        u3: { name: 'Sie', points: 120 },
      },
      galaxy: [
        { id: 'p1_1_5', kind: 'planet', owner: 'u1' },
        { id: 'm1_1_5', kind: 'moon', owner: 'u1' },
        { id: 'p1_2_6', kind: 'planet', owner: 'u1' },
        { id: 'p1_3_7', kind: 'planet', owner: 'u2' },
      ],
      fleets: [
        { id: 'f1', owner: 'u1', mission: 'attack' },
        { id: 'f2', owner: 'u1', mission: 'deploy', gift: true },
        { id: 'f3', owner: 'u2', mission: 'attack' },
        { id: 'f4', owner: 'u1', mission: 'missile' },
      ],
    } as unknown as GameState,
    P: here,
    R: { research: {}, rq: null },
    now: 1234,
    ui: {} as unknown as Ui,
  };
};

describe('the own state of the Lexicanum', () => {
  it('counts the own planets without moons, the own fleets that take a slot and the points', () => {
    const own = ownState(view());
    expect(own.planet.id).toBe('p1_1_5');
    expect(own.planets).toBe(2);
    expect(own.fleets).toBe(1);
    expect(own.points).toEqual({ own: 40, top: 900 });
    expect(own.now).toBe(1234);
  });

  it('counts a planned start of an attack union as a fleet that takes a slot (#478, PR #490)', () => {
    const v = view();
    (v.s as unknown as { unions: unknown[] }).unions = [
      { id: 'u9', leader: 'u1', start: 1, held: { from: 'p1_1_5', ships: {} } },
      { id: 'u8', leader: 'u2', start: 1 },
    ];
    expect(ownState(v).fleets).toBe(2);
  });

  it('knows a player without points and a state without players', () => {
    const v = view();
    v.s.players = {};
    expect(ownState(v).points).toEqual({ own: 0, top: 0 });
  });
});
