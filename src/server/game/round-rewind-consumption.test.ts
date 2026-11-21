// The Runden-Rewind, card 5 (#235, owner 2026-11-21, Q26): the facts that show
// a consumption of ships the ledger does not subtract must really be in the
// events the journal writes. The events here come from real arrivals through
// `tick`, not from hand-made payloads; only the loss and the recovery that
// frame them are synthetic.
import { describe, expect, it } from 'vitest';
import { UNIT } from '../../core/catalog.ts';
import { EVENT_KIND } from '../../core/round-events.ts';
import {
  largestLoss,
  recoveryOf,
  type RewindEvent,
} from '../../core/round-rewind-facts.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { tick } from './arrival.ts';
import { seatOf } from './round-events.ts';

const DAY = 86_400_000;
const lf = UNIT.lf!.cost;

function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addUser(ctx, 'Cora');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, ships: { lf: 3 } });
  addPlanet(ctx, 'u_Cora', { g: 1, s: 3, p: 7, ships: { lf: 3 } });
  return ctx;
}

const fleet = (ctx: TestCtx, id: string, owner: string, over: Partial<Fleet>) =>
  ctx.fleets.save({
    id,
    owner,
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'p1_3_7',
    toC: { g: 1, s: 3, p: 7 },
    mission: 'attack',
    ships: { lf: 20 },
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - 2000,
    arr: ctx.now() - 500,
    ret: ctx.now() + 100,
    state: 'out',
    recalled: false,
    fuel: 0,
    ...over,
  });

const journal = (ctx: TestCtx, seat?: number): RewindEvent[] =>
  (seat === undefined
    ? ctx.rounds.events(1)
    : ctx.rounds.eventsForSeat(1, seat)
  ).map((e) => ({
    at: e.at,
    kind: e.kind,
    seat: e.seat,
    version: e.version,
    payload: e.payload as Record<string, unknown>,
  }));

/** The ships built by a synthetic action of the seat at `at`. */
const built = (me: number, at: number, n: number): RewindEvent => ({
  at,
  kind: EVENT_KIND.action,
  seat: me,
  version: 2,
  payload: {
    cause: 'build',
    ok: true,
    prod: [
      {
        place: 'p1_1_5',
        owner: me,
        m: 0,
        c: 0,
        d: 0,
        from: 0,
        to: 1,
        f: 1,
        unitsCost: { ships: lf.map((x) => x * n) },
      },
    ],
  },
});

/** What card 5 says for a seat when a loss comes before `real` and a recovery after it. */
function around(me: number, real: RewindEvent[]) {
  const times = real.length ? real.map((e) => e.at) : [10_000];
  const first = Math.min(...times);
  const last = Math.max(...times);
  const events: RewindEvent[] = [
    {
      at: -1,
      kind: EVENT_KIND.joined,
      seat: me,
      version: 2,
      payload: { entry: 'home', places: [] },
    },
    built(me, first - 3000, 10),
    {
      at: first - 2000,
      kind: EVENT_KIND.arrival,
      seat: me,
      version: 2,
      payload: {
        mission: 'attack',
        target: 9,
        battle: { attBefore: { lf: 10 }, attAfter: { lf: 4 } },
      },
    },
    ...real,
    built(me, last + 1000, 6),
  ];
  return recoveryOf(events, me, largestLoss(events, me)!);
}

describe('the facts that show an unrecorded consumption, in the real journal', () => {
  it('a colonisation: the arrival of mission colonize and the colony founded by it at the same time', () => {
    const ctx = setup();
    fleet(ctx, 'c1', 'u_Anna', {
      mission: 'colonize',
      to: 'p1_1_9',
      toC: { g: 1, s: 1, p: 9 },
      ships: { colony: 1 },
    });
    tick(ctx);
    const me = seatOf(ctx, 'u_Anna')!;
    const events = journal(ctx);
    const arrival = events.find((e) => e.kind === EVENT_KIND.arrival)!;
    expect(arrival.payload).toMatchObject({
      mission: 'colonize',
      fate: 'gone',
    });
    const colony = events.find((e) => e.kind === EVENT_KIND.created)!;
    expect(colony).toMatchObject({ seat: me, at: arrival.at });
    expect(colony.payload).toMatchObject({ kind: 'planet', cause: 'arrival' });
    expect(around(me, events)).toBeNull();
    // The seat filter keeps the facts: the same answer from the events of the seat only.
    expect(around(me, journal(ctx, me))).toBeNull();
  });

  it('a joined fleet: the report of the battle goes to the seat that is neither the leader nor the target', () => {
    const ctx = setup();
    // Bert leads the attack on Cora; Anna's fleet joined the union.
    fleet(ctx, 'lead', 'u_Bert', {
      from: 'p1_2_6',
      fromC: { g: 1, s: 2, p: 6 },
      union: 'lead',
    });
    fleet(ctx, 'join', 'u_Anna', { union: 'lead', arr: ctx.now() - 400 });
    tick(ctx);
    const me = seatOf(ctx, 'u_Anna')!;
    const battle = journal(ctx).find((e) => e.kind === EVENT_KIND.arrival)!;
    expect(battle.seat).toBe(seatOf(ctx, 'u_Bert'));
    expect(battle.payload.target).toBe(seatOf(ctx, 'u_Cora'));
    expect(battle.payload.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'battle', to: me }),
      ]),
    );
    expect(around(me, journal(ctx))).toBeNull();
    expect(around(me, journal(ctx, me))).toBeNull();
  });

  it('a held fleet: the report of the battle goes to the owner of the fleet that defended', () => {
    const ctx = setup();
    // Anna's fleet holds at Cora's planet; Bert attacks it.
    fleet(ctx, 'held', 'u_Anna', {
      mission: 'hold',
      state: 'hold',
      arr: ctx.now() - 5000,
      hold: 5 * DAY,
      ships: { lf: 5 },
    });
    fleet(ctx, 'raid', 'u_Bert', {
      from: 'p1_2_6',
      fromC: { g: 1, s: 2, p: 6 },
    });
    tick(ctx);
    const me = seatOf(ctx, 'u_Anna')!;
    const battle = journal(ctx).find(
      (e) => e.kind === EVENT_KIND.arrival && e.payload.mission === 'attack',
    )!;
    expect(battle.seat).toBe(seatOf(ctx, 'u_Bert'));
    expect(battle.payload.reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'battle', to: me }),
      ]),
    );
    expect(around(me, journal(ctx))).toBeNull();
    expect(around(me, journal(ctx, me))).toBeNull();
  });

  it('a clean window shows the card', () => {
    expect(around(1, [])).toMatchObject({ days: 1 });
  });
});
