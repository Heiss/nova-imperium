// The seat filter of the Runden-Rewind (#235): `eventsForSeat` loads only what
// the cards of one seat can read, and the cards must be the same as with all
// the events of the round. Proved on generated rounds against the unfiltered
// `events`, for every seat, including the rarer shapes: a place of the seat in
// the `prod` of another seat's event, a battle that names the seat as target or
// reports to it, a union the seat sent a fleet into, the ring-in of the Endzeit
// and a round with events of version 1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENDZEIT_EVENT, EVENT_KIND } from '../../core/round-events.ts';
import {
  completeFor,
  endzeitOf,
  investmentOf,
  largestLoss,
  productionOf,
  recoveryOf,
  type RewindEvent,
} from '../../core/round-rewind-facts.ts';
import { testCtx } from '../test-helpers.ts';

const SEATS = [1, 2, 3, 4] as const;
const seat = fc.constantFrom<number | null>(1, 2, 3, 4, null);
const units = fc.record({ lf: fc.integer({ min: 0, max: 9 }) });
const prodEntry = fc.record({
  place: fc.constant('p1_1_1'),
  owner: seat,
  m: fc.integer({ min: 0, max: 900 }),
  c: fc.integer({ min: 0, max: 900 }),
  d: fc.integer({ min: 0, max: 900 }),
  unitsCost: fc.record({
    ships: fc.tuple(
      fc.integer({ min: 0, max: 5000 }),
      fc.integer({ min: 0, max: 5000 }),
      fc.integer({ min: 0, max: 5000 }),
    ),
  }),
});
const fleet = fc.record(
  {
    mission: fc.constantFrom('attack', 'expedition', 'colonize', 'transport'),
    target: seat,
    fleet: fc.constantFrom('f1', 'f2'),
    ships: units,
    fate: fc.constantFrom('gone', 'back', 'hold'),
    gift: fc.constant(true),
    battle: fc.record({
      attBefore: units,
      attAfter: units,
      defBefore: units,
      defAfter: units,
    }),
    reports: fc.array(
      fc.record({
        type: fc.constantFrom('battle', 'info'),
        to: seat,
      }),
      { maxLength: 3 },
    ),
    prod: fc.array(prodEntry, { maxLength: 2 }),
  },
  { requiredKeys: ['mission', 'fleet', 'ships', 'fate'] },
);
const action = fc.record(
  {
    cause: fc.constantFrom('send', 'build'),
    ok: fc.boolean(),
    input: fc.record(
      { union: fc.constantFrom('f1', 'f2', '') },
      { requiredKeys: [] },
    ),
    prod: fc.array(prodEntry, { maxLength: 2 }),
  },
  { requiredKeys: ['cause', 'ok', 'input'] },
);
const joined = fc.record({
  entry: fc.constantFrom('home', 'present'),
  places: fc.constant([{ ships: { lf: 3 } }]),
});
const created = fc.record({
  kind: fc.constantFrom('planet', 'moon'),
  cause: fc.constantFrom('arrival', 'send'),
});
const research = fc.record({
  cost: fc.tuple(fc.nat(500), fc.nat(500), fc.nat(500)),
});
const close = fc.record({ prod: fc.array(prodEntry, { maxLength: 2 }) });

const event = fc.oneof(
  fc.record({ kind: fc.constant(EVENT_KIND.joined), seat, payload: joined }),
  fc.record({ kind: fc.constant(EVENT_KIND.action), seat, payload: action }),
  fc.record({
    kind: fc.constantFrom(
      EVENT_KIND.arrival,
      EVENT_KIND.hold,
      EVENT_KIND.return,
    ),
    seat,
    payload: fleet,
  }),
  fc.record({
    kind: fc.constant(EVENT_KIND.research),
    seat,
    payload: research,
  }),
  fc.record({
    kind: fc.constantFrom(EVENT_KIND.created, EVENT_KIND.removed),
    seat,
    payload: created,
  }),
  fc.record({
    kind: fc.constant(EVENT_KIND.close),
    seat: fc.constant(null),
    payload: close,
  }),
  fc.record({
    kind: fc.constant(ENDZEIT_EVENT),
    seat: fc.constant(null),
    payload: fc.constant({ minutes: 5 }),
  }),
  fc.record({
    kind: fc.constant('player.final'),
    seat,
    payload: fc.constant({ points: 1 }),
  }),
);
const stamped = fc.record({
  e: event,
  at: fc.integer({ min: 0, max: 6 }),
  // Mostly version 2; one in ten of version 1.
  version: fc.constantFrom(2, 2, 2, 2, 2, 2, 2, 2, 2, 1),
});

/** What the cards of the seat make of the events: every function of the reader. */
function cards(events: readonly RewindEvent[], s: number): unknown {
  const loss = largestLoss(events, s);
  return {
    complete: completeFor(events, s),
    production: productionOf(events, s),
    investment: investmentOf(events, s),
    loss,
    recovery: loss && recoveryOf(events, s, loss),
    endzeit: endzeitOf(events, s),
  };
}

const asEvents = (
  rows: ReturnType<ReturnType<typeof testCtx>['rounds']['events']>,
) =>
  rows.map((r) => ({
    at: r.at,
    kind: r.kind,
    seat: r.seat,
    version: r.version,
    payload: r.payload,
  })) as RewindEvent[];

describe('eventsForSeat', () => {
  it('property: the cards of a seat are the same with the filtered events as with all of them', () => {
    const ctx = testCtx();
    fc.assert(
      fc.property(fc.array(stamped, { maxLength: 40 }), (list) => {
        ctx.db.exec('DELETE FROM round_events');
        for (const { e, at, version } of list)
          ctx.rounds.addEvent(1, 0, { at, version, ...e });
        const all = ctx.rounds.events(1);
        for (const s of SEATS) {
          const filtered = ctx.rounds.eventsForSeat(1, s);
          // A subset of the round, in the same order.
          const ids = all.map((r) => r.id);
          expect(filtered.map((r) => r.id)).toEqual(
            ids.filter((id) => filtered.some((r) => r.id === id)),
          );
          expect(cards(asEvents(filtered), s)).toEqual(cards(asEvents(all), s));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('leaves out what no card of the seat reads, and keeps the five kinds of events it needs', () => {
    const ctx = testCtx();
    const add = (
      seat: number | null,
      kind: string,
      payload: object,
      version = 2,
    ) => ctx.rounds.addEvent(1, 0, { at: 1, kind, seat, version, payload });
    add(1, EVENT_KIND.action, { cause: 'build', ok: true }); // own
    add(2, EVENT_KIND.action, { cause: 'build', ok: true }); // another seat
    add(2, EVENT_KIND.action, { cause: 'build', prod: [{ owner: 1 }] }); // a place of the seat
    add(2, EVENT_KIND.arrival, { target: 1, battle: {} }); // the seat is the target
    add(2, EVENT_KIND.arrival, { reports: [{ type: 'battle', to: 1 }] }); // reported to the seat
    add(2, EVENT_KIND.arrival, { reports: [{ type: 'info', to: 1 }] }); // not a battle report
    add(1, EVENT_KIND.action, {
      cause: 'send',
      ok: true,
      input: { union: 'u1' },
    });
    add(3, EVENT_KIND.arrival, { fleet: 'u1', battle: {} }); // the union the seat joined
    add(3, EVENT_KIND.arrival, { fleet: 'u2', battle: {} }); // another union
    add(null, ENDZEIT_EVENT, { minutes: 5 });
    add(null, 'player.final', {});
    const kept = ctx.rounds.eventsForSeat(1, 1);
    // 1 own, 3 (prod, target, report), the send, the union, the ring-in, own send again counted once.
    expect(kept).toHaveLength(7);
    expect(kept.map((r) => r.kind)).not.toContain('player.final');
    // A round with an event of version 1: one witness of it is kept, and no more.
    add(2, EVENT_KIND.action, { cause: 'build' }, 1);
    add(2, EVENT_KIND.action, { cause: 'build' }, 1);
    expect(
      ctx.rounds.eventsForSeat(1, 1).filter((r) => r.version === 1),
    ).toHaveLength(1);
  });

  it('answers only for the round asked', () => {
    const ctx = testCtx();
    ctx.rounds.open({ number: 2, started: 0, coverage: 'complete', rules: {} });
    ctx.rounds.addEvent(2, 0, {
      at: 1,
      kind: EVENT_KIND.action,
      seat: 1,
      version: 2,
      payload: {},
    });
    expect(ctx.rounds.eventsForSeat(1, 1)).toEqual([]);
  });
});
