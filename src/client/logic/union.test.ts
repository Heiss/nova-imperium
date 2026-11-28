// What the browser works out of the attack union (#225): the rows of the box,
// which fleets can open a union, the unions the fleet form offers, the arrival
// line of a joining fleet and the words behind an own fleet of a union.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { flightMs } from '../../core/flight.ts';
import type { Universe } from '../../core/types.ts';
import { dt } from './format.ts';
import {
  joinChoices,
  limitsOf,
  unionArrivalLine,
  planJoin,
  unionJoin,
  unionPart,
  unionSpeed,
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
  it('are read from the three settings, the classic values by default', () => {
    expect(limitsOf(round())).toEqual({ fleets: 16, players: 5, cutoff: 0 });
    expect(
      limitsOf(round({ unionFleets: 4, unionPlayers: 3, unionCutoff: 5 })),
    ).toEqual({ fleets: 4, players: 3, cutoff: 5 });
  });
});

describe('the unions of the state', () => {
  it('are none for a state without them, as in the lock screen of the vacation mode', () => {
    expect(unionsOf({})).toEqual([]);
    expect(unionRows(view(undefined))).toEqual([]);
    expect(joinChoices(view(undefined))).toEqual([]);
    expect(unionRows(view([]))).toEqual([]);
  });
  it('names every invited player who has not joined, in the order of the invitations', () => {
    const [row] = unionRows(view([union({ invited: ['u3', 'u2'] })]));
    expect(row!.invited).toBe('Cora, Bert');
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

describe('planning a union (#466, A1a)', () => {
  const cfg = { speed: 1 } as Universe;
  const fleet1 = { dist: 1000, speed: 10000 };
  const fast = flightMs(1000, 10000, 10, cfg);
  const slow = flightMs(1000, 10000, 1, cfg);
  const s = (r = round()) => ({ round: r, cfg });
  it('flies the fleet of the leader at the speed that brings it there at X', () => {
    expect(planJoin(s(), 10_000 + fast, 10_000, fleet1)).toEqual({
      pct: expect.closeTo(10, 6),
      ms: fast,
      arr: 10_000 + fast,
    });
    expect(planJoin(s(), 10_000 + slow, 10_000, fleet1)).toMatchObject({
      pct: expect.closeTo(1, 6),
    });
  });
  it('asks for an arrival, in the future and beyond the cut-off, and says the bounds of the speed', () => {
    expect(planJoin(s(), Number.NaN, 10_000, fleet1)).toEqual({
      refusal: 'Bitte die Ankunft des Verbands wählen.',
    });
    expect(planJoin(s(), 10_000, 10_000, fleet1)).toEqual({
      refusal: 'Die Ankunft muss in der Zukunft liegen.',
    });
    expect(
      planJoin(s(round({ unionCutoff: 60 })), 10_000 + fast, 10_000, fleet1),
    ).toEqual({
      refusal:
        'Die Ankunft muss mehr als 60 Minuten in der Zukunft liegen, sonst kann niemand mehr beitreten.',
    });
    expect(planJoin(s(), 10_000 + fast - 1, 10_000, fleet1)).toEqual({
      refusal:
        'Deine Flotte erreicht das Ziel selbst mit 100 % nicht bis zur Ankunft des Verbands.',
    });
    expect(planJoin(s(), 10_000 + slow + 1, 10_000, fleet1)).toEqual({
      // Rounded up to the second, as the server says it.
      refusal: `Deine Flotte wäre selbst mit 10 % zu früh da. Schicke sie frühestens am ${dt(11_000)} los.`,
    });
  });
});

describe('a fleet of a union', () => {
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

describe('the arrival of a fleet that joins (#466)', () => {
  const cfg = { speed: 1 } as Universe;
  const s = (r = round()) => ({ unions: [union()], round: r, cfg });
  // A fleet 1000 away at the speed 10000: its flight at 10 % and at 100 %.
  const fleet = { dist: 1000, speed: 10000 };
  const slow = flightMs(1000, 10000, 1, cfg);
  const fast = flightMs(1000, 10000, 10, cfg);
  it('flies the time left to X at the speed that brings it there, and back as long', () => {
    const now = 100_000 - Math.round((slow + fast) / 2);
    const join = unionJoin(s(), 'f1', now, fleet)!;
    expect(join).toEqual({
      pct: expect.closeTo(1.818, 2),
      ms: 100_000 - now,
      arr: 100_000,
    });
    expect(unionArrivalLine(join)).toBe(
      `${dt(100_000)} / ${dt(200_000 - now)} <span class="dim">(Verband: Geschwindigkeit 18,2 %)</span>`,
    );
  });
  it('words the speed in percent with one decimal', () => {
    expect(unionSpeed(1)).toBe('10 %');
    expect(unionSpeed(3.75)).toBe('37,5 %');
    expect(unionSpeed(10)).toBe('100 %');
  });
  it('says the words of the server when the fleet is refused', () => {
    const early = unionJoin(s(), 'f1', 100_000 - slow - 1, fleet)!;
    expect(unionArrivalLine(early)).toBe(
      `<span class="bad">Deine Flotte wäre selbst mit 10 % zu früh da. Schicke sie frühestens am ${dt(100_000 - slow)} los.</span>`,
    );
    expect(
      unionArrivalLine(unionJoin(s(), 'f1', 100_000 - fast + 1, fleet)!),
    ).toBe(
      '<span class="bad">Deine Flotte erreicht das Ziel selbst mit 100 % nicht bis zur Ankunft des Verbands.</span>',
    );
    expect(unionJoin(s(), 'f1', 100_000, fleet)).toEqual({
      refusal: 'Der Angriffsverband ist schon angekommen.',
    });
    expect(
      unionJoin(s(round({ unionCutoff: 2 })), 'f1', 100_000 - 120_000, fleet),
    ).toEqual({
      refusal:
        'In den letzten 2 Minuten vor der Ankunft tritt niemand mehr bei.',
    });
  });
  it('is nothing for a union that is not in the state', () => {
    expect(unionJoin(s(), 'other', 10_000, fleet)).toBeNull();
    expect(unionJoin({ round: round(), cfg }, 'f1', 10_000, fleet)).toBeNull();
  });
});
