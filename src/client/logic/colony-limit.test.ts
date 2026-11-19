// The limit of planets as the browser shows it (#237): the line beside a
// Landnahme and in the overview.
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import {
  colonyNote,
  flyingColonies,
  ownedPlanets,
  planetsLine,
} from './colony-limit.ts';
import type { GameState } from './types.ts';

type Kind = 'planet' | 'moon';
const place = (id: string, kind: Kind, owner = 'u1') => ({
  id,
  kind,
  name: id,
  g: 1,
  s: 1,
  p: 1,
  temp: 1,
  owner,
});
const fleet = (mission: string, state: string, owner = 'u1') => ({
  id: `${mission}-${state}-${owner}`,
  owner,
  mission,
  state,
});

const EXAMPLE = {
  ...U,
  roundColonyBase: 6,
  roundColonyResearch: 1,
  roundColonyPerLevel: 2,
  roundColonyMaxLevel: 4,
};

/** Anna with `planets` planets and a moon, a stranger's planet and the given fleets. */
const state = (
  planets: number,
  over: Record<string, unknown> = {},
  fleets: unknown[] = [],
): GameState =>
  ({
    cfg: EXAMPLE,
    me: { id: 'u1', research: {} },
    galaxy: [
      ...Array.from({ length: planets }, (_, i) => place(`p${i}`, 'planet')),
      place('m1', 'moon'),
      place('x1', 'planet', 'u2'),
    ],
    fleets,
    ...over,
  }) as unknown as GameState;

describe('counting', () => {
  it('counts the own planets, no moon and no foreign planet', () => {
    expect(ownedPlanets(state(3))).toBe(3);
    expect(ownedPlanets(state(0))).toBe(0);
  });

  it('counts the own colonization fleets on their way out, not the returning ones, not other missions, not foreign ones', () => {
    const fleets = [
      fleet('colonize', 'out'),
      fleet('colonize', 'back'),
      fleet('transport', 'out'),
      fleet('colonize', 'out', 'u2'),
    ];
    expect(flyingColonies(state(1, {}, fleets))).toBe(1);
    expect(flyingColonies(state(1, {}, []))).toBe(0);
  });
});

describe('the line', () => {
  it('shows the planets against the limit with the research level (the owner`s words)', () => {
    const s = state(6, { me: { id: 'u1', research: { colonial: 1 } } });
    expect(planetsLine(s)).toBe('Planeten: 6 / 8 · Kolonialverwaltung Stufe 1');
  });

  it('shows no limit as „unbegrenzt“', () => {
    expect(planetsLine(state(6, { cfg: U }))).toBe('Planeten: 6 · unbegrenzt');
  });

  it('is only for a mission that founds a colony', () => {
    expect(colonyNote(state(3), 'attack')).toBe('');
    expect(colonyNote(state(3), '')).toBe('');
    expect(colonyNote(state(3), 'colonize')).toBe(
      'Planeten: 3 / 6 · Kolonialverwaltung Stufe 0',
    );
  });

  it('adds the refusal when the limit leaves no room, planets and colonies on their way counted', () => {
    expect(colonyNote(state(6), 'colonize')).toBe(
      'Planeten: 6 / 6 · Kolonialverwaltung Stufe 0 · Planetengrenze erreicht (6/6). Erforsche Kolonialverwaltung oder gib eine Kolonie auf.',
    );
    expect(
      colonyNote(state(5, {}, [fleet('colonize', 'out')]), 'colonize'),
    ).toContain('Planetengrenze erreicht (6/6).');
    expect(colonyNote(state(5), 'colonize')).not.toContain('erreicht');
    // Without a limit there is no refusal.
    expect(colonyNote(state(30, { cfg: U }), 'colonize')).toBe(
      'Planeten: 30 · unbegrenzt',
    );
  });

  it('leaves the research out of the words when the round has none', () => {
    const cfg = { ...EXAMPLE, roundColonyResearch: 0 };
    expect(colonyNote(state(6, { cfg }), 'colonize')).toBe(
      'Planeten: 6 / 6 · Planetengrenze erreicht (6/6). Gib eine Kolonie auf.',
    );
  });
});
