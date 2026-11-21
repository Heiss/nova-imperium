// The reader of the Runden-Rewind (#235, owner 2026-11-21): the values of the
// cards 2, 3, 4, 5 and 7 derived from ordered round events, and the rule that a
// round without complete version 2 events has none of the cards that need them.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SHIPS, UNIT } from './catalog.ts';
import { ENDZEIT_EVENT, EVENT_KIND } from './round-events.ts';
import {
  completeFor,
  constructionValue,
  endzeitOf,
  focusOf,
  INVESTMENT,
  investmentOf,
  largestLoss,
  productionOf,
  recoveryOf,
  type RewindEvent,
} from './round-rewind-facts.ts';
import type { Levels } from './types.ts';

const DAY = 86_400_000;
const ME = 2;
const FOE = 3;

const ev = (
  at: number,
  kind: string,
  seat: number | null,
  payload: object = {},
  version = 2,
): RewindEvent => ({
  at,
  kind,
  seat,
  version,
  payload: payload as Record<string, unknown>,
});

const joined = (seat = ME, entry: 'home' | 'present' = 'home', ships = {}) =>
  ev(0, EVENT_KIND.joined, seat, {
    entry,
    places: [{ kind: 'planet', g: 1, s: 1, p: 1, b: {}, ships, def: {} }],
    research: {},
  });

const prod = (owner: number | null, over: object = {}) => ({
  place: 'p1_1_1',
  owner,
  from: 0,
  to: 1,
  m: 0,
  c: 0,
  d: 0,
  f: 1,
  ...over,
});

const action = (at: number, entries: object[], seat: number | null = ME) =>
  ev(at, EVENT_KIND.action, seat, {
    cause: 'build',
    input: {},
    ok: true,
    prod: entries,
  });

/** The cost of `n` units of `key` as a cost vector. */
const costOf = (key: string, n = 1) => UNIT[key]!.cost.map((x) => x * n);

/** An arrival of the fleet of `seat` at the place of `target`; `att` and `def` are `[before, after]`. */
const fight = (
  at: number,
  seat: number,
  target: number | null,
  att: [Levels, Levels],
  def: [Levels, Levels] = [{}, {}],
  over: object = {},
) =>
  ev(at, EVENT_KIND.arrival, seat, {
    cause: 'arrival',
    mission: 'attack',
    target,
    ships: att[0],
    cargo: { m: 0, c: 0, d: 0 },
    fate: 'back',
    battle: {
      attBefore: att[0],
      attAfter: att[1],
      defBefore: def[0],
      defAfter: def[1],
    },
    ...over,
  });

const built = (at: number, key: string, n: number, seat = ME) =>
  action(at, [prod(seat, { unitsCost: { ships: costOf(key, n) } })], seat);

const sum3 = (v: number[]) => v[0]! + v[1]! + v[2]!;

describe('completeFor', () => {
  it('needs events, none of version 1 and a joining with a home planet', () => {
    expect(completeFor([], ME)).toBe(false);
    expect(completeFor([joined()], ME)).toBe(true);
  });

  it('is false for a round of version 1 only and for a mixed round', () => {
    const old = ev(0, EVENT_KIND.joined, ME, { entry: 'home' }, 1);
    expect(completeFor([old], ME)).toBe(false);
    expect(completeFor([joined(), action(5, [], ME)], ME)).toBe(true);
    expect(
      completeFor([joined(), ev(5, EVENT_KIND.action, FOE, {}, 1)], ME),
    ).toBe(false);
  });

  it('looks at the events of the journal only: the facts of the close and the annotations have their own version', () => {
    const closeFacts = [
      ev(9, 'player.final', ME, {}, 1),
      ev(9, 'round.closed', null, {}, 1),
      ev(9, ENDZEIT_EVENT, 1, {}, 1),
    ];
    expect(completeFor([joined(), ...closeFacts], ME)).toBe(true);
    expect(completeFor(closeFacts, ME)).toBe(false);
  });

  it('is false for a seat that joined in mid-round or has no joining', () => {
    expect(completeFor([joined(ME, 'present')], ME)).toBe(false);
    expect(completeFor([joined(FOE)], ME)).toBe(false);
    expect(completeFor([action(1, [])], ME)).toBe(false);
  });
});

describe('card 2: productionOf', () => {
  it('sums what the game credited to the places of the seat, from every kind of event', () => {
    const events = [
      joined(),
      action(10, [prod(ME, { m: 100.4, c: 50, d: 0 })]),
      ev(20, EVENT_KIND.arrival, ME, {
        prod: [prod(ME, { m: 10.4, c: 0, d: 5 })],
      }),
      ev(30, EVENT_KIND.hold, ME, { prod: [prod(ME, { m: 1 })] }),
      ev(40, EVENT_KIND.return, ME, { prod: [prod(ME, { c: 1 })] }),
      ev(50, EVENT_KIND.close, null, {
        cause: 'close',
        prod: [prod(ME, { d: 1 })],
      }),
    ];
    expect(productionOf(events, ME)).toEqual({
      m: 112,
      c: 51,
      d: 6,
      total: 169,
    });
  });

  it('counts a place of the seat in the event of another seat, and no place of another seat', () => {
    const events = [
      joined(),
      action(10, [prod(FOE, { m: 999 }), prod(ME, { m: 7 })], FOE),
    ];
    expect(productionOf(events, ME)).toMatchObject({ m: 7, total: 7 });
  });

  it('takes the refund of a demolition out of the credit', () => {
    const events = [
      joined(),
      action(10, [
        prod(ME, {
          m: 300,
          c: 100,
          d: 0,
          built: {
            key: 'metal',
            lvl: 1,
            end: 9,
            cost: [1, 1, 1],
            back: [200, 100, 0],
          },
        }),
      ]),
    ];
    expect(productionOf(events, ME)).toMatchObject({
      m: 100,
      c: 0,
      d: 0,
      total: 100,
    });
  });

  it('has no card for nothing produced, for no events and for an incomplete round', () => {
    expect(productionOf([joined(), action(1, [prod(ME)])], ME)).toBeNull();
    expect(
      productionOf([joined(), action(1, [prod(ME, { m: -5 })])], ME),
    ).toBeNull();
    expect(productionOf([], ME)).toBeNull();
    const old = ev(1, EVENT_KIND.action, ME, { prod: [prod(ME, { m: 5 })] }, 1);
    expect(productionOf([joined(), old], ME)).toBeNull();
    expect(
      productionOf(
        [joined(ME, 'present'), action(1, [prod(ME, { m: 5 })])],
        ME,
      ),
    ).toBeNull();
  });

  it('does not count the cargo of a gift fleet: only the credited stock is production', () => {
    const gift = ev(9, EVENT_KIND.arrival, ME, {
      gift: true,
      cargo: { m: 1e6, c: 1e6, d: 1e6 },
      ships: {},
    });
    expect(
      productionOf([joined(), gift, action(10, [prod(ME, { m: 3 })])], ME)
        ?.total,
    ).toBe(3);
  });
});

describe('card 3: investmentOf and focusOf', () => {
  const events = [
    joined(),
    action(1, [
      prod(ME, { built: { key: 'metal', lvl: 1, end: 1, cost: [100, 50, 0] } }),
      prod(ME, {
        built: {
          key: 'metal',
          lvl: 1,
          end: 1,
          cost: [10, 10, 10],
          back: [5, 5, 5],
        },
      }),
    ]),
    ev(2, EVENT_KIND.research, ME, {
      key: 'energy',
      lvl: 1,
      end: 2,
      cost: [0, 200, 100],
      cause: 'x',
    }),
    ev(2, EVENT_KIND.research, FOE, {
      key: 'energy',
      lvl: 1,
      end: 2,
      cost: [9999, 0, 0],
      cause: 'x',
    }),
    action(3, [
      prod(ME, {
        unitsCost: { ships: [1000, 0, 0], def: [20, 30, 0] },
      }),
    ]),
  ];

  it('sums the finished buildings (no demolition), research, ships and defense apart', () => {
    expect(investmentOf(events, ME)).toEqual({
      buildings: 150,
      research: 300,
      fleet: 1000,
      defense: 50,
    });
  });

  it('names the category with the largest share and its whole percent', () => {
    expect(focusOf(investmentOf(events, ME)!)).toEqual({
      focus: 'fleet',
      percent: 67,
    });
    expect(
      focusOf({ buildings: 58, research: 20, fleet: 12, defense: 10 }),
    ).toEqual({
      focus: 'buildings',
      percent: 58,
    });
    expect(
      focusOf({ buildings: 0, research: 1, fleet: 0, defense: 0 }),
    ).toEqual({
      focus: 'research',
      percent: 100,
    });
    expect(
      focusOf({ buildings: 0, research: 0, fleet: 0, defense: 9 }),
    ).toEqual({
      focus: 'defense',
      percent: 100,
    });
  });

  it('has no focus when nothing was paid or when two categories share the largest part', () => {
    expect(
      focusOf({ buildings: 0, research: 0, fleet: 0, defense: 0 }),
    ).toBeNull();
    expect(
      focusOf({ buildings: 5, research: 5, fleet: 1, defense: 0 }),
    ).toBeNull();
    expect(
      focusOf({ buildings: 5, research: 4, fleet: 5, defense: 5 }),
    ).toBeNull();
    expect(
      focusOf({ buildings: 6, research: 5, fleet: 5, defense: 0 }),
    ).toEqual({
      focus: 'buildings',
      percent: 38,
    });
  });

  it('is null for an incomplete round', () => {
    expect(investmentOf([], ME)).toBeNull();
    expect(
      investmentOf(
        events.map((e) => ({ ...e, version: 1 })),
        ME,
      ),
    ).toBeNull();
  });

  it('property: the focus is a category with the strictly largest amount and its percent is a share of the whole', () => {
    const amount = fc.integer({ min: 0, max: 1_000_000 });
    fc.assert(
      fc.property(
        amount,
        amount,
        amount,
        amount,
        (buildings, research, fleet, defense) => {
          const spent = { buildings, research, fleet, defense };
          const focus = focusOf(spent);
          const all = buildings + research + fleet + defense;
          const most = Math.max(...INVESTMENT.map((k) => spent[k]));
          const leaders = INVESTMENT.filter((k) => spent[k] === most);
          if (all === 0 || leaders.length !== 1) return focus === null;
          return (
            focus !== null &&
            focus.focus === leaders[0] &&
            focus.percent === Math.round((most / all) * 100) &&
            focus.percent >= 25 &&
            focus.percent <= 100
          );
        },
      ),
    );
  });
});

describe('card 4: largestLoss', () => {
  const lf = SHIPS.lf!;
  const worth = (key: string, n: number) => sum3(costOf(key, n));

  it('is the attacker loss of ship construction value, in Flottenpunkte (value / 1000)', () => {
    const loss = largestLoss(
      [fight(5 * DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }])],
      ME,
    );
    expect(loss).toEqual({
      at: 5 * DAY,
      value: worth('lf', 6),
      points: Math.floor(worth('lf', 6) / 1000),
      role: 'attacker',
      opponent: FOE,
    });
    expect(lf.cost[0]! + lf.cost[1]! + lf.cost[2]!).toBe(worth('lf', 1));
  });

  it('is the defender loss when the seat owned the target, the opponent is the attacker', () => {
    const loss = largestLoss(
      [
        fight(
          DAY,
          FOE,
          ME,
          [{ hf: 3 }, { hf: 3 }],
          [
            { lf: 5, rl: 20 },
            { lf: 2, rl: 0 },
          ],
        ),
      ],
      ME,
    );
    expect(loss).toMatchObject({
      role: 'defender',
      opponent: FOE,
      value: worth('lf', 3),
    });
  });

  it('does not count the defense that fell, and gives no card for a loss of defense only', () => {
    const only = fight(
      DAY,
      FOE,
      ME,
      [{ hf: 3 }, { hf: 3 }],
      [{ rl: 20 }, { rl: 0 }],
    );
    expect(largestLoss([only], ME)).toBeNull();
  });

  it('is the single battle with the largest loss; the earliest of equal losses', () => {
    const small = fight(DAY, ME, FOE, [{ lf: 5 }, { lf: 4 }]);
    const big = fight(3 * DAY, ME, FOE, [{ lf: 5 }, { lf: 1 }]);
    const same = fight(
      4 * DAY,
      FOE,
      ME,
      [{ hf: 1 }, { hf: 1 }],
      [{ lf: 5 }, { lf: 1 }],
    );
    expect(largestLoss([small, big, same], ME)?.at).toBe(3 * DAY);
    // The same loss, earlier in the logical time though written later.
    expect(largestLoss([same, big], ME)?.at).toBe(3 * DAY);
    expect(largestLoss([big, small], ME)?.value).toBe(worth('lf', 4));
  });

  it('has no card without a loss: no events, no battle, a battle without loss, a battle of others', () => {
    expect(largestLoss([], ME)).toBeNull();
    expect(largestLoss([action(1, [])], ME)).toBeNull();
    expect(
      largestLoss([fight(1, ME, FOE, [{ lf: 5 }, { lf: 5 }])], ME),
    ).toBeNull();
    expect(
      largestLoss([fight(1, FOE, 9, [{ lf: 5 }, { lf: 0 }])], ME),
    ).toBeNull();
    const noNumbers = ev(1, EVENT_KIND.arrival, ME, { battle: { rounds: 3 } });
    expect(largestLoss([noNumbers], ME)).toBeNull();
  });

  it('reads battles of version 1 as well, they hold the numbers', () => {
    const old = { ...fight(1, ME, FOE, [{ lf: 2 }, {}]), version: 1 };
    expect(largestLoss([old], ME)?.value).toBe(worth('lf', 2));
  });

  it('names no opponent when the events name none, and counts surplus survivors as no loss', () => {
    const loss = largestLoss(
      [
        fight(1, ME, null, [{ lf: 2 }, { lf: 9 }]),
        fight(2, ME, null, [{ lf: 2 }, {}]),
      ],
      ME,
    );
    expect(loss).toMatchObject({ at: 2, opponent: null, role: 'attacker' });
  });

  it('is a loss of at least one Flottenpunkt for any ship', () => {
    for (const key of Object.keys(SHIPS))
      expect(
        largestLoss([fight(1, ME, FOE, [{ [key]: 1 }, {}])], ME)?.points,
      ).toBeGreaterThanOrEqual(1);
  });

  it('property: the result is the largest of the single losses and never exceeds the fleet sent', () => {
    const count = fc.integer({ min: 0, max: 50 });
    const battle = fc.record({ n: count, left: count, att: fc.boolean() });
    fc.assert(
      fc.property(fc.array(battle, { maxLength: 8 }), (list) => {
        const events = list.map((b, i) => {
          const after = Math.min(b.n, b.left);
          return b.att
            ? fight((i + 1) * DAY, ME, FOE, [{ lf: b.n }, { lf: after }])
            : fight(
                (i + 1) * DAY,
                FOE,
                ME,
                [{ hf: 1 }, { hf: 1 }],
                [{ lf: b.n }, { lf: after }],
              );
        });
        const values = list.map((b) =>
          worth('lf', b.n - Math.min(b.n, b.left)),
        );
        const best = Math.max(0, ...values);
        const loss = largestLoss(events, ME);
        return best === 0
          ? loss === null
          : loss?.value === best &&
              loss.at === (values.indexOf(best) + 1) * DAY;
      }),
    );
  });
});

describe('card 5: recoveryOf', () => {
  const lossOf = (events: RewindEvent[]) => largestLoss(events, ME)!;
  const base = (extra: RewindEvent[]) => [joined(), ...extra];

  it('is the days from the loss to the first event at which the value is back', () => {
    const events = base([
      built(1 * DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(3 * DAY, 'lf', 3),
      built(7 * DAY, 'lf', 3),
    ]);
    expect(recoveryOf(events, ME, lossOf(events))).toEqual({
      days: 5,
      at: 7 * DAY,
    });
  });

  it('counts the level to the unit: one ship short is not back', () => {
    const events = base([
      built(DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(5 * DAY, 'lf', 5),
    ]);
    expect(recoveryOf(events, ME, lossOf(events))).toBeNull();
    events.push(built(6 * DAY, 'lf', 1));
    expect(recoveryOf(events, ME, lossOf(events))).toEqual({
      days: 4,
      at: 6 * DAY,
    });
  });

  it('is at least one day, also on the same day', () => {
    const events = base([
      built(DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 9 }]),
      built(2 * DAY + 1000, 'lf', 1),
    ]);
    expect(recoveryOf(events, ME, lossOf(events))).toEqual({
      days: 1,
      at: 2 * DAY + 1000,
    });
  });

  it('counts the production of the event of the loss before the loss, and earlier losses after their own events', () => {
    const events = base([
      built(DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 8 }]),
      fight(3 * DAY, ME, FOE, [{ lf: 8 }, { lf: 2 }]),
      built(4 * DAY, 'lf', 4),
    ]);
    // The loss of 6 ships on day 3 left 2; the level before was 8 ships.
    const loss = lossOf(events);
    expect(loss.at).toBe(3 * DAY);
    expect(recoveryOf(events, ME, loss)).toBeNull();
    events.push(built(5 * DAY, 'lf', 2));
    expect(recoveryOf(events, ME, loss)).toEqual({ days: 2, at: 5 * DAY });
  });

  it('a later loss does not undo a recovery, and a bigger loss in between is the loss of the card', () => {
    const events = base([
      built(DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(3 * DAY, 'lf', 6),
      fight(4 * DAY, ME, FOE, [{ lf: 10 }, { lf: 9 }]),
    ]);
    // Back at day 3 (before the later small loss): a later loss does not undo it.
    expect(recoveryOf(events, ME, lossOf(events))).toEqual({
      days: 1,
      at: 3 * DAY,
    });
    events.splice(3, 1);
    events.push(fight(3 * DAY - 1, ME, FOE, [{ lf: 4 }, { lf: 0 }]));
    // A bigger loss in between is another loss; the card-4 loss is that one.
    expect(recoveryOf(events, ME, lossOf(events))).toBeNull();
  });

  it('is null when the value before the loss is smaller than the loss: the events miss ships', () => {
    const events = base([
      fight(DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(2 * DAY, 'lf', 50),
    ]);
    expect(recoveryOf(events, ME, lossOf(events))).toBeNull();
  });

  it('counts the ships of the baseline', () => {
    const events = [
      joined(ME, 'home', { lf: 10 }),
      fight(DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(3 * DAY, 'lf', 6),
    ];
    expect(recoveryOf(events, ME, lossOf(events))).toEqual({
      days: 2,
      at: 3 * DAY,
    });
  });

  it('is null when the gift of the Endzeit arrived between the loss and the recovery', () => {
    const gift = ev(3 * DAY, EVENT_KIND.arrival, ME, {
      gift: true,
      ships: { lf: 42 },
      cargo: { m: 0, c: 0, d: 0 },
    });
    const events = base([
      built(DAY, 'lf', 10),
      fight(2 * DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      gift,
      built(4 * DAY, 'lf', 1),
    ]);
    expect(recoveryOf(events, ME, lossOf(events))).toBeNull();
    // A gift before the loss is own value like any other ship.
    const before = base([
      { ...gift, at: DAY },
      fight(2 * DAY, ME, FOE, [{ lf: 42 }, { lf: 40 }]),
      built(3 * DAY, 'lf', 2),
    ]);
    expect(recoveryOf(before, ME, lossOf(before))).toEqual({
      days: 1,
      at: 3 * DAY,
    });
  });

  it('is null for no events, a round of version 1, a mixed round and a seat that joined mid-round', () => {
    const loss = {
      at: DAY,
      points: 1,
      value: 1000,
      role: 'attacker' as const,
      opponent: FOE,
    };
    expect(recoveryOf([], ME, loss)).toBeNull();
    const events = base([
      built(DAY / 2, 'lf', 10),
      fight(DAY, ME, FOE, [{ lf: 10 }, { lf: 4 }]),
      built(2 * DAY, 'lf', 6),
    ]);
    const l = lossOf(events);
    expect(recoveryOf(events, ME, l)).not.toBeNull();
    expect(
      recoveryOf(
        events.map((e) => ({ ...e, version: 1 })),
        ME,
        l,
      ),
    ).toBeNull();
    expect(
      recoveryOf(
        [{ ...events[1]!, version: 1 }, ...events.filter((_, i) => i !== 1)],
        ME,
        l,
      ),
    ).toBeNull();
    expect(
      recoveryOf([joined(ME, 'present'), ...events.slice(1)], ME, l),
    ).toBeNull();
  });

  it('property: a recovery is after the loss, at least one day later, and the ships it needs were built', () => {
    const count = fc.integer({ min: 1, max: 20 });
    fc.assert(
      fc.property(count, count, count, (start, lostN, later) => {
        const gone = Math.min(start, lostN);
        const events = base([
          built(DAY, 'lf', start),
          fight(2 * DAY, ME, FOE, [{ lf: start }, { lf: start - gone }]),
          built(5 * DAY, 'lf', later),
        ]);
        const r = recoveryOf(events, ME, lossOf(events));
        // Back exactly when the later build replaces what fell.
        return later >= gone ? r?.days === 3 && r.at === 5 * DAY : r === null;
      }),
    );
  });
});

describe('card 7: endzeitOf', () => {
  const ring = (at: number) =>
    ev(
      at,
      ENDZEIT_EVENT,
      1,
      { minutes: 5, recipients: 2, due: at + 300_000 },
      1,
    );
  const gift = (seat = ME) =>
    ev(5, EVENT_KIND.arrival, seat, {
      gift: true,
      ships: { lf: 42, hf: 42 },
      cargo: { m: 1e6, c: 1e6, d: 1e6 },
    });

  it('is the time the Endzeit was rung in and the gift that landed at the seat', () => {
    expect(endzeitOf([joined(), ring(27 * DAY), gift()], ME)).toEqual({
      at: 27 * DAY,
      gift: { ships: 84, cargo: { m: 1e6, c: 1e6, d: 1e6 } },
    });
  });

  it('has no gift when none arrived for the seat, the Endzeit still stands', () => {
    expect(endzeitOf([joined(), ring(DAY), gift(FOE)], ME)).toEqual({
      at: DAY,
      gift: null,
    });
  });

  it('takes the first ring-in and is not confused by an action of that name', () => {
    const action = ev(1, EVENT_KIND.action, 1, { cause: 'endzeit', ok: false });
    expect(endzeitOf([joined(), action], ME)).toBeNull();
    expect(endzeitOf([joined(), ring(3 * DAY), ring(2 * DAY)], ME)?.at).toBe(
      2 * DAY,
    );
  });

  it('is null without an Endzeit and for an incomplete round', () => {
    expect(endzeitOf([joined()], ME)).toBeNull();
    expect(endzeitOf([], ME)).toBeNull();
    expect(endzeitOf([{ ...joined(), version: 1 }, ring(DAY)], ME)).toBeNull();
    expect(endzeitOf([joined(ME, 'present'), ring(DAY)], ME)).toBeNull();
  });
});

describe('constructionValue', () => {
  it('is the raw cost of the units, a key that is not in the catalog adds nothing', () => {
    expect(constructionValue({})).toBe(0);
    expect(constructionValue({ nope: 3 })).toBe(0);
    expect(constructionValue({ lf: 2, rl: 1 })).toBe(
      sum3(costOf('lf', 2)) + sum3(costOf('rl')),
    );
  });

  it('property: the value of a mixed set is the sum of its parts', () => {
    const n = fc.integer({ min: 0, max: 99 });
    fc.assert(
      fc.property(n, n, (a, b) => {
        return (
          constructionValue({ lf: a, rl: b }) ===
          constructionValue({ lf: a }) + constructionValue({ rl: b })
        );
      }),
    );
  });
});
