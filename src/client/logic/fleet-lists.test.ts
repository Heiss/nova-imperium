// The list „Auftrag“ and the list „Schnellwahl“ of the fleet form (#253):
// what the browser knows of the target, the missions that fit it, and the
// options of the two lists.
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import {
  fitTarget,
  missionOptions,
  NO_MISSION,
  offeredMissions,
  ownQuickTargets,
  QUICK_FIRST,
} from './fleet-target.ts';
import type { GameState } from './types.ts';

type Kind = 'planet' | 'moon';
const place = (
  id: string,
  kind: Kind,
  name: string,
  g: number,
  s: number,
  p: number,
  owner = 'u1',
) => ({ id, kind, name, g, s, p, temp: 1, owner });

const state = (over: Record<string, unknown> = {}): GameState =>
  ({
    cfg: U,
    me: { id: 'u1', research: {} },
    players: {},
    galaxy: [place('p1_2_6', 'planet', 'Beta', 1, 2, 6, 'u2')],
    debris: [],
    ...over,
  }) as unknown as GameState;

const NOW = 1_000;
const to = (g: number, s: number, p: number, kind?: 'moon') => ({
  g,
  s,
  p,
  ...(kind ? { kind } : {}),
});

describe('what the browser knows of the target', () => {
  it('is the planet or moon there, a Trümmerfeld, a lock that still holds and the expedition position', () => {
    const s = state({
      debris: [{ id: 'd1_2_6', g: 1, s: 2, p: 6, m: 1, c: 1 }],
      locks: [
        { g: 1, s: 2, p: 9, until: NOW + 1 },
        { g: 1, s: 2, p: 10, until: NOW },
      ],
    });
    expect(fitTarget(s, to(1, 2, 6), NOW)).toEqual({
      planet: { id: 'p1_2_6', owner: 'u2' },
      debris: true,
      moon: false,
      locked: false,
      expedition: false,
    });
    expect(fitTarget(s, to(1, 2, 9), NOW)).toMatchObject({
      planet: null,
      debris: false,
      locked: true,
    });
    // A lock is over at its end.
    expect(fitTarget(s, to(1, 2, 10), NOW).locked).toBe(false);
    expect(fitTarget(s, to(1, 2, 16), NOW).expedition).toBe(true);
    // A moon aimed at where none is: no place, but a moon target.
    expect(fitTarget(s, to(1, 2, 6, 'moon'), NOW)).toMatchObject({
      planet: null,
      moon: true,
    });
  });

  it('is no lock without a list of locks', () => {
    expect(fitTarget(state(), to(1, 2, 9), NOW).locked).toBe(false);
  });
});

describe('the missions offered for a target', () => {
  it('are those of the target, in the order of the form', () => {
    expect(offeredMissions(state(), 'p1_1_5', to(1, 2, 6), 0)).toEqual([
      'attack',
      'transport',
      'spy',
      'hold',
    ]);
    expect(offeredMissions(state(), 'p1_1_5', to(1, 2, 9), 0)).toEqual([
      'colonize',
      'survey',
    ]);
    expect(offeredMissions(state(), 'p1_1_5', to(1, 2, 16), 0)).toEqual([
      'expedition',
    ]);
  });

  it('are none while the target is the planet the form starts from', () => {
    const own = state({
      galaxy: [place('p1_1_5', 'planet', 'Heimat', 1, 1, 5)],
    });
    expect(offeredMissions(own, 'p1_1_5', to(1, 1, 5), 0)).toEqual([]);
    expect(offeredMissions(own, 'p1_2_1', to(1, 1, 5), 0)).toEqual([
      'transport',
      'deploy',
    ]);
  });
});

describe('the options of the list „Auftrag“', () => {
  it('select the chosen mission while it fits, else the first one', () => {
    expect(missionOptions(['attack', 'transport'], 'transport')).toEqual({
      html: '<option value="attack" >Sturmangriff</option><option value="transport" selected>Versorgungsflug</option>',
      selected: 'transport',
    });
    expect(missionOptions(['colonize', 'survey'], 'attack').selected).toBe(
      'colonize',
    );
    expect(missionOptions(['colonize', 'survey'], undefined).selected).toBe(
      'colonize',
    );
    expect(missionOptions(['colonize', 'survey'], 'survey').selected).toBe(
      'survey',
    );
  });

  it('say that no mission fits, in a disabled entry without a value', () => {
    expect(missionOptions([], 'attack')).toEqual({
      html: '<option value="" selected disabled>Kein Auftrag passt zum Ziel</option>',
      selected: '',
    });
    expect(NO_MISSION).toBe('Kein Auftrag passt zum Ziel');
  });
});

describe('the list „Schnellwahl“', () => {
  it('lists the other own planets and moons by position, the planet before its moon, as „Name [g:s:p]“ and „Name (Mond) [g:s:p]“', () => {
    const s = state({
      galaxy: [
        place('p2_1_3', 'planet', 'Zweite', 2, 1, 3),
        place('m1_1_5', 'moon', 'Mond', 1, 1, 5),
        place('p1_1_5', 'planet', 'Heimat', 1, 1, 5),
        place('p1_2_6', 'planet', 'Beta <b>', 1, 2, 6, 'u2'),
        place('p1_1_9', 'planet', 'Kolonie', 1, 1, 9),
      ],
    });
    expect(ownQuickTargets(s, 'p1_1_9')).toEqual([
      { id: 'p1_1_5', label: 'Heimat [1:1:5]' },
      { id: 'm1_1_5', label: 'Mond (Mond) [1:1:5]' },
      { id: 'p2_1_3', label: 'Zweite [2:1:3]' },
    ]);
  });

  it('is empty without another own place', () => {
    expect(ownQuickTargets(state(), 'p1_1_5')).toEqual([]);
  });

  it('starts with „– wählen –“', () => {
    expect(QUICK_FIRST).toBe('– wählen –');
  });
});
