// What the browser works out of the attack union (#225): the rows of the box,
// which fleets can open a union, the unions the fleet form offers, the arrival
// line of a joining fleet and the words behind an own fleet of a union.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { flightMs } from '../../core/flight.ts';
import type { Universe } from '../../core/types.ts';
import { text } from '../../core/text.ts';
import { dt } from './format.ts';
import {
  joinChoices,
  limitsOf,
  unionArrivalLine,
  freeShips,
  heldBack,
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
        start: null,
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
      start: null,
    });
  });
});

describe('a union whose leader’s fleet starts later (#478)', () => {
  it('counts the leader’s fleet from the planning and names its start', () => {
    const planned = union({
      start: 50_000,
      fleets: [{ id: 'f2', owner: 'u2' }],
    });
    const [row] = unionRows(view([planned], 'u1'));
    expect(row).toMatchObject({
      start: 50_000,
      counts: expect.stringMatching(/^Flotten 2 \/ \d+ · Spieler 2 \/ \d+$/),
      fleets: 'Anna (1), Bert (1)',
    });
  });

  it('holds back the planned ships of the leader on their planet only, for him only', () => {
    const s = {
      unions: [
        union({ start: 1, held: { from: 'p1', ships: { bs: 3, lf: 1 } } }),
        union({ id: 'u9', start: 2, held: { from: 'p1', ships: { bs: 2 } } }),
        union({ id: 'u8', start: 3, held: { from: 'p2', ships: { bs: 9 } } }),
        union({ id: 'u7' }),
      ],
    };
    expect(heldBack(s, 'p1')).toEqual({ bs: 5, lf: 1 });
    expect(heldBack(s, 'p3')).toEqual({});
    expect(freeShips(s, { id: 'p1', ships: { bs: 4, lf: 3, sc: 2 } })).toEqual({
      bs: 0,
      lf: 2,
      sc: 2,
    });
    expect(freeShips({}, { id: 'p1', ships: { bs: 4 } })).toEqual({ bs: 4 });
  });
});

describe('planning a union (#466, A1a)', () => {
  const cfg = { speed: 1 } as Universe;
  const fleet1 = { dist: 1000, speed: 10000, pct: 5 };
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
  });
  it('starts the leader’s fleet later at the step of the form when even 10 % is too early (#478)', () => {
    const arr = 10_000 + slow + 1;
    const ms = flightMs(1000, 10000, 5, cfg);
    const later = planJoin(s(), arr, 10_000, fleet1);
    expect(later).toEqual({ pct: 5, ms, arr, start: arr - ms });
    expect(unionArrivalLine(later)).toBe(
      `${dt(arr)} / ${dt(arr + ms)} <span class="dim">(Verband: Start am ${dt(arr - ms)} mit 50 %)</span>`,
    );
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

  it('lists a planned start of the leader among the movements, by its time, with „Abbrechen“ (#478)', () => {
    const planned = union({
      id: 'u9',
      start: 50_000,
      arr: 90_000,
      held: { from: 'p1', ships: { bs: 3 } },
    });
    const v = {
      ...view([planned, union({ id: 'u8', start: 60_000 })]),
    } as V;
    v.s = {
      ...v.s,
      fleets: [
        fleet({ id: 'late', arr: 70_000 }),
        fleet({ id: 'early', arr: 20_000 }),
      ],
    };
    const rows = fleetRows(v, false);
    expect(rows.map((r) => r.id)).toEqual(['early', 'plan_u9', 'late']);
    expect(rows[1]).toEqual({
      id: 'plan_u9',
      due: { end: 50_000, left: expect.any(String) },
      cls: 'fl-attack',
      parts: [
        {
          text: `Geplanter Start: Deine Flotte (3 ${text('bs')!.n}) greift [1:4:8] an · Angriffsverband (Anführer), Ankunft ${dt(90_000)}`,
          bold: false,
        },
      ],
      recall: false,
      cancel: 'u9',
    });
    expect(rows[0]).not.toHaveProperty('cancel');
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
