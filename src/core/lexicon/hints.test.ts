// The personal hints of „Deine nächsten Ziele“ (#289): each is one rule of
// the game, computed from the own state, so each is tested at its border.
import { describe, expect, it } from 'vitest';
import { planet } from '../../test/fixtures.ts';
import { caps } from '../economy.ts';
import { fleetSlots } from '../flight.ts';
import { fill } from './links.ts';
import { type Hint, hintsOf, MOST_HINTS } from './hints.ts';
import { defaultState } from './state.ts';
import type { LexState, Own } from './types.ts';

/** The state of a player with a shown planet and what the test changes. */
const state = (
  p = planet(),
  own: Partial<Own> = {},
  over: Partial<LexState> = {},
): LexState => ({
  ...defaultState(),
  ...over,
  own: {
    planet: p,
    planets: 1,
    fleets: 0,
    points: { own: 0, top: 0 },
    now: 0,
    ...own,
  },
});

const ids = (s: LexState): string[] => hintsOf(s).map((h) => h.id);
const words = (h: Hint): string => fill(h.text, h.values);

/** A planet with everything in order: a mine with energy, a store with room, a free field. */
const fine = () =>
  planet({
    b: { metal: 2, crystal: 1, solar: 8, lab: 1 },
    res: { m: 10, c: 10, d: 0 },
  });

describe('the hints of the own state', () => {
  it('has none without the own state, and no limit that holds a hint for a fine planet', () => {
    expect(hintsOf(defaultState())).toEqual([]);
    expect(ids(state(fine()))).not.toContain('energy');
    expect(ids(state(fine()))).not.toContain('store');
    expect(ids(state(fine()))).not.toContain('fields');
    expect(ids(state(fine()))).not.toContain('slots');
    expect(ids(state(fine()))).not.toContain('limit');
  });

  it('says that energy is short, with the share the mines run at', () => {
    const mine = planet({ b: { metal: 10 }, res: { m: 1, c: 1, d: 0 } });
    const [hint] = hintsOf(state(mine));
    expect(hint!.id).toBe('energy');
    expect(words(hint!)).toMatch(/laufen nur mit [\d,]+ % ihrer Leistung/);
    // Without a consumer there is no lack, and with enough energy neither.
    expect(ids(state(planet()))).not.toContain('energy');
    expect(ids(state(planet({ b: { metal: 1, solar: 12 } })))).not.toContain(
      'energy',
    );
  });

  it('names the stores that are full, and only those', () => {
    const u = defaultState().u;
    const full = planet({ res: { m: caps(planet(), u).m, c: 5, d: 0 } });
    const hint = hintsOf(state(full)).find((h) => h.id === 'store')!;
    expect(words(hint)).toContain('Das Lager für Adamant ist voll');
    expect(words(hint)).toContain('[[smetal]]');
    const two = planet({
      res: { m: caps(planet(), u).m + 1, c: caps(planet(), u).c, d: 0 },
    });
    expect(words(hintsOf(state(two)).find((h) => h.id === 'store')!)).toContain(
      'Adamant, Psikristall',
    );
    // One unit below the limit is not full.
    const almost = planet({ res: { m: caps(planet(), u).m - 1, c: 0, d: 0 } });
    expect(ids(state(almost))).not.toContain('store');
  });

  it('says that no field is free, on a planet and on a moon', () => {
    const small = planet({ diameter: 1000, b: { metal: 1 } });
    const hint = hintsOf(state(small)).find((h) => h.id === 'fields')!;
    expect(words(hint)).toContain('(Felder: 1)');
    expect(
      ids(state(planet({ diameter: 2000, b: { metal: 1 } }))),
    ).not.toContain('fields');
    const moon = planet({ kind: 'moon', diameter: 1000, b: { robot: 1 } });
    expect(ids(state(moon))).toContain('fields-moon');
    expect(ids(state(moon))).not.toContain('fields');
    // A planet without a field limit is never full.
    expect(
      ids(state(planet({ unlimited: true, b: { metal: 500 } }))),
    ).not.toContain('fields');
  });

  it('says that every fleet slot is in use, at the number of slots', () => {
    const slots = fleetSlots({ research: {} });
    const research = { computer: 2 };
    const s = (fleets: number, r: Record<string, number> = {}) =>
      state(fine(), { fleets }, { research: r });
    expect(ids(s(slots - 1))).not.toContain('slots');
    expect(ids(s(slots))).toContain('slots');
    // The research brings a slot, so the same number of fleets is no hint.
    expect(ids(s(slots, research))).not.toContain('slots');
    expect(ids(s(fleetSlots({ research }), research))).toContain('slots');
  });

  it('says that the limit of planets is reached, and what raises it where the round has it', () => {
    const base = defaultState();
    const round = (research: number, planets: number, level = 0) =>
      state(
        fine(),
        { planets },
        {
          research: { colonial: level },
          u: {
            ...base.u,
            roundColonyBase: 3,
            roundColonyResearch: research,
            roundColonyPerLevel: 2,
            roundColonyMaxLevel: 2,
          },
        },
      );
    expect(ids(round(1, 2))).not.toContain('limit');
    expect(ids(round(1, 3))).toEqual(
      expect.arrayContaining(['limit', 'limit-research']),
    );
    // Without the research of the round only the limit is named.
    expect(ids(round(0, 3))).toContain('limit');
    expect(ids(round(0, 3))).not.toContain('limit-research');
    // At the highest level of the research nothing is left to raise.
    expect(ids(round(1, 7, 2))).toContain('limit');
    expect(ids(round(1, 7, 2))).not.toContain('limit-research');
    // The default round has no limit.
    expect(ids(state(fine(), { planets: 20 }))).not.toContain('limit');
    expect(
      words(hintsOf(round(1, 3)).find((h) => h.id === 'limit')!),
    ).toContain('(Planeten: 3 von 3)');
  });

  it('names an entry whose only missing requirement is one level away', () => {
    // The Auspex-Lehre needs the Scholarium at level 3 and nothing else.
    const lab = (level: number) =>
      planet({ ...fine(), b: { ...fine().b, lab: level } });
    const near = (level: number) =>
      hintsOf(state(lab(level))).filter((h) => h.id === 'near-spy');
    expect(near(2)).toHaveLength(1);
    expect(words(near(2)[0]!)).toContain(
      'Dir fehlt noch eine Stufe, um [[spy]] zu bekommen: [[lab]] steht auf Stufe 2 und müsste Stufe 3 haben.',
    );
    expect(near(1)).toHaveLength(0);
    expect(near(3)).toHaveLength(0);
  });

  it('does not name a building the shown place cannot hold', () => {
    const all = (kind: 'planet' | 'moon') =>
      ids(state(planet({ kind, b: {} }))).filter((id) =>
        id.startsWith('near-'),
      );
    expect(all('planet')).not.toContain('near-phalanx');
    expect(all('planet')).not.toContain('near-moonbase');
  });

  it('says that only the base income comes in on a planet without a mine', () => {
    const hint = hintsOf(state(planet())).find((h) => h.id === 'start')!;
    expect(words(hint)).toContain('100 Adamant und 50 Psikristall je Stunde');
    expect(ids(state(planet({ b: { metal: 1 } })))).not.toContain('start');
    expect(ids(state(planet({ b: { crystal: 1 } })))).not.toContain('start');
    expect(ids(state(planet({ kind: 'moon' })))).not.toContain('start');
  });

  it('shows few hints, in the order of the rules, never more than the most', () => {
    const base = defaultState();
    const all = state(
      planet({
        diameter: 1000,
        b: { metal: 10 },
        res: { m: 1e9, c: 0, d: 0 },
      }),
      { planets: 3, fleets: 1 },
      {
        u: {
          ...base.u,
          roundColonyBase: 3,
          roundColonyResearch: 1,
        },
      },
    );
    const found = ids(all);
    expect(found).toHaveLength(MOST_HINTS);
    expect(found).toEqual([
      'energy',
      'store',
      'fields',
      'slots',
      'limit',
      'limit-research',
    ]);
  });
});
