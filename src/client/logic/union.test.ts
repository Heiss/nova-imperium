// What the browser works out of the attack union (#225): the rows of the box,
// which fleets can open a union, the unions the fleet form offers, the arrival
// line of a joining fleet and the words behind an own fleet of a union.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { dt, dur } from './format.ts';
import {
  canOpenUnion,
  joinChoices,
  limitsOf,
  openRows,
  unionArrivalLine,
  unionPart,
  unionRows,
  unionsOf,
} from './union.ts';
import { fleetRows } from './overview.ts';
import type { ClientFleet, GameState, UnionState } from './types.ts';
import type { V } from '../views/common.ts';

const round = (over: Record<string, number> = {}): RoundRules =>
  ({ number: 1, ...roundDefaults(), ...over }) as RoundRules;

const union = (over: Partial<UnionState> = {}): UnionState => ({
  id: 'f1',
  leader: 'u1',
  to: 'p1_4_8',
  toC: { g: 1, s: 4, p: 8 },
  arr: 100_000,
  fleets: [
    { id: 'f1', owner: 'u1' },
    { id: 'f2', owner: 'u2' },
    { id: 'f3', owner: 'u2' },
  ],
  invited: ['u3'],
  ...over,
});

const view = (unions: UnionState[] | undefined, me = 'u1', r = round()) =>
  ({
    s: {
      me: { id: me },
      round: r,
      unions,
      fleets: [],
      players: {
        u1: { name: 'Anna', points: 1 },
        u2: { name: 'Bert', points: 1 },
        u3: { name: 'Cora', points: 1 },
      },
    } as unknown as GameState,
    P: {},
    R: {},
    now: 10_000,
    ui: {},
  }) as unknown as V;

const fleet = (over: Partial<ClientFleet> = {}): ClientFleet => ({
  id: 'f1',
  owner: 'u1',
  fromC: { g: 1, s: 1, p: 5 },
  toC: { g: 1, s: 4, p: 8 },
  to: 'p1_4_8',
  mission: 'attack',
  state: 'out',
  arr: 100_000,
  ships: { lf: 3 },
  ...over,
});

describe('the limits of the round', () => {
  it('are read from the four settings, the classic values by default', () => {
    expect(limitsOf(round())).toEqual({
      fleets: 16,
      players: 5,
      delay: 30,
      cutoff: 0,
    });
    expect(
      limitsOf(
        round({
          unionFleets: 4,
          unionPlayers: 3,
          unionDelay: 10,
          unionCutoff: 5,
        }),
      ),
    ).toEqual({ fleets: 4, players: 3, delay: 10, cutoff: 5 });
  });
});

describe('the unions of the state', () => {
  it('are none for a state without them, as in the lock screen of the vacation mode', () => {
    expect(unionsOf({})).toEqual([]);
    expect(unionRows(view(undefined))).toEqual([]);
    expect(joinChoices(view(undefined))).toEqual([]);
    expect(unionRows(view([]))).toEqual([]);
  });
  it('are shown with the leader, the counts against the limits, the fleets per owner and the invited', () => {
    expect(unionRows(view([union()]))).toEqual([
      {
        id: 'f1',
        title: 'Verbandsangriff auf [1:4:8]',
        toC: { g: 1, s: 4, p: 8 },
        arr: 100_000,
        leader: 'Anna',
        counts: 'Flotten 3 / 16 · Spieler 2 / 5',
        fleets: 'Anna (1), Bert (2)',
        invited: 'Cora',
        leads: true,
      },
    ]);
  });
  it('count against the limits of the round and say who leads', () => {
    const [row] = unionRows(
      view(
        [union({ invited: [] })],
        'u2',
        round({ unionFleets: 8, unionPlayers: 2 }),
      ),
    );
    expect(row).toMatchObject({
      counts: 'Flotten 3 / 8 · Spieler 2 / 2',
      invited: '',
      leads: false,
    });
  });
});

describe('opening a union', () => {
  it('is offered for an own Sturmangriff on its way that has not arrived, in no union', () => {
    expect(canOpenUnion(fleet(), 'u1', 10_000)).toBe(true);
    expect(canOpenUnion(fleet({ arr: 10_000 }), 'u1', 10_000)).toBe(false);
    expect(canOpenUnion(fleet({ owner: 'u2' }), 'u1', 10_000)).toBe(false);
    expect(canOpenUnion(fleet({ mission: 'transport' }), 'u1', 10_000)).toBe(
      false,
    );
    expect(canOpenUnion(fleet({ state: 'back' }), 'u1', 10_000)).toBe(false);
    expect(canOpenUnion(fleet({ state: 'hold' }), 'u1', 10_000)).toBe(false);
    expect(canOpenUnion(fleet({ gift: true }), 'u1', 10_000)).toBe(false);
    expect(canOpenUnion(fleet({ union: 'f1' }), 'u1', 10_000)).toBe(false);
  });
  it('lists the own fleets that can open one, by arrival, with their target', () => {
    const rows = (fleets: ClientFleet[], now = 10_000) =>
      openRows({ ...view([]), s: { ...view([]).s, fleets }, now } as V);
    expect(
      rows([
        fleet({ id: 'late', arr: 300_000 }),
        fleet({ id: 'soon', arr: 200_000, toC: { g: 2, s: 3, p: 4 } }),
        fleet({ id: 'union', union: 'union' }),
        fleet({ id: 'foreign', owner: 'u2' }),
        fleet({ id: 'back', state: 'back' }),
      ]),
    ).toEqual([
      { id: 'soon', target: '[2:3:4]', arr: 200_000 },
      { id: 'late', target: '[1:4:8]', arr: 300_000 },
    ]);
    expect(rows([fleet()], 100_000)).toEqual([]);
  });
  it('is told in the line of an own fleet of a union', () => {
    expect(unionPart(fleet())).toBe('');
    expect(unionPart(fleet({ union: 'f1' }))).toBe(
      ' · Angriffsverband (Anführer)',
    );
    expect(unionPart(fleet({ id: 'f2', union: 'f1' }))).toBe(
      ' · im Angriffsverband',
    );
    const [row] = fleetRows(
      {
        ...view([]),
        s: { ...view([]).s, fleets: [fleet({ union: 'f1' })] },
      } as V,
      false,
    );
    expect(row!.parts[0]!.text).toContain(' · Angriffsverband (Anführer)');
  });
});

describe('the choice „Verband“ of the fleet form', () => {
  it('offers every union with its leader, its target and its arrival, and knows a moon', () => {
    const choices = joinChoices(
      view([
        union(),
        union({ id: 'f9', to: 'm1_2_3', toC: { g: 1, s: 2, p: 3 } }),
      ]),
    );
    expect(choices).toEqual([
      {
        id: 'f1',
        label: `Anna → [1:4:8], Ankunft ${dt(100_000)}`,
        to: { g: 1, s: 4, p: 8 },
        moon: false,
      },
      {
        id: 'f9',
        label: `Anna → [1:2:3], Ankunft ${dt(100_000)}`,
        to: { g: 1, s: 2, p: 3 },
        moon: true,
      },
    ]);
  });
});

describe('the arrival of a fleet that joins', () => {
  const s = (r = round()) => ({ unions: [union()], round: r });
  it('arrives with the union when it is there in time, and flies back as long as it flew', () => {
    expect(unionArrivalLine(s(), 'f1', 10_000, 50_000)).toBe(
      `${dt(100_000)} / ${dt(150_000)}`,
    );
  });
  it('delays the union and says by how much, within the percentage of the round', () => {
    // 90 s left, a flight of 110 s: 20 s later, 22 % of the time left.
    expect(unionArrivalLine(s(), 'f1', 10_000, 110_000)).toBe(
      `${dt(120_000)} / ${dt(230_000)} <span class="dim">(verzögert den Verband um ${dur(20_000)})</span>`,
    );
  });
  it('says the words of the server when the fleet is refused', () => {
    expect(unionArrivalLine(s(), 'f1', 10_000, 130_000)).toBe(
      '<span class="bad">Deine Flotte käme zu spät: Sie würde den Angriffsverband um mehr als 30 % der Restflugzeit verzögern.</span>',
    );
    expect(unionArrivalLine(s(), 'f1', 100_000, 1)).toBe(
      '<span class="bad">Der Angriffsverband ist schon angekommen.</span>',
    );
    expect(
      unionArrivalLine(
        s(round({ unionCutoff: 2 })),
        'f1',
        100_000 - 120_000 + 1,
        1,
      ),
    ).toBe(
      '<span class="bad">In den letzten 2 Minuten vor der Ankunft tritt niemand mehr bei.</span>',
    );
  });
  it('is nothing for a union that is not in the state', () => {
    expect(unionArrivalLine(s(), 'other', 10_000, 1)).toBeNull();
    expect(unionArrivalLine({ round: round() }, 'f1', 10_000, 1)).toBeNull();
  });
});
