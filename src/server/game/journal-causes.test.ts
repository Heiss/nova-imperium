// The journal of the round (#235), driven directly: what a cause collects
// (saved places, reports), how a refusal is scrubbed, the fate of a fleet and
// that a failing write never breaks the game. The flow through the real
// actions is in journal.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENT_KIND, type JournalAction } from '../../core/round-events.ts';
import { prod } from '../../core/economy.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import {
  beginCause,
  causePending,
  dropCause,
  fleetBefore,
  journalAction,
  journalFleet,
  journalRefusal,
} from './journal.ts';

const HOUR = 3600000;

afterEach(() => {
  dropCause();
  vi.restoreAllMocks();
});

function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addUser(ctx, 'Jo');
  return ctx;
}

const events = (ctx: TestCtx, kind: string = EVENT_KIND.action) =>
  ctx.rounds.events(1, kind);
const payloads = (ctx: TestCtx, kind?: string) =>
  events(ctx, kind).map((e) => e.payload as Record<string, unknown>);

/** A planet of Anna that has produced for `hours` hours, ready to be saved at the later time. */
function advanced(ctx: TestCtx, over: object = {}, hours = 2) {
  const planet = addPlanet(ctx, 'u_Anna', {
    b: { metal: 3, crystal: 2, deut: 2, solar: 8 },
    res: { m: 5000, c: 2000, d: 1000 },
    ...over,
  });
  ctx.clock.t += hours * HOUR;
  return { planet, later: { ...planet, t: ctx.now() } };
}

const report = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  time: 0,
  type: 'battle' as const,
  title: 'T',
  ...over,
});

describe('the cause that is collecting', () => {
  it('is pending from its begin until an action takes it, or it is dropped', () => {
    const ctx = setup();
    expect(causePending()).toBe(false);
    beginCause();
    expect(causePending()).toBe(true);
    dropCause();
    expect(causePending()).toBe(false);
    beginCause();
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    expect(causePending()).toBe(false);
    beginCause();
    journalRefusal(ctx, 'u_Anna', 'read', {}, 'x');
    expect(causePending()).toBe(false);
  });

  it('writes an action that ran outside a cause, without production and reports', () => {
    const ctx = setup();
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', { type: 'read' });
    expect(payloads(ctx)).toEqual([{ cause: 'read', input: {}, ok: true }]);
  });

  it('logs a failed write and goes on', () => {
    const ctx = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(ctx.rounds, 'addEvent').mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() =>
      journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {}),
    ).not.toThrow();
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0]![0]).toBe(
      'Journal of the round: an event was not written',
    );
    expect(String(err.mock.calls[0]![1])).toContain('disk full');
  });
});

describe('what a saved place produced', () => {
  it('records the credits of every resource, the factor and no building or unit when none finished', () => {
    const ctx = setup();
    const { planet, later } = advanced(ctx);
    beginCause();
    ctx.planets.save(later);
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    const [p] = payloads(ctx) as unknown as JournalAction[];
    const made = p!.prod![0]!;
    const owner = ctx.players.get('u_Anna')!;
    const saved = settle(planet, later.t, ctx.admin.universe(), owner);
    expect(made.m).toBeGreaterThan(0);
    expect(made.c).toBeGreaterThan(0);
    expect(made.d).toBeGreaterThan(0);
    expect(made.m).toBeCloseTo(saved.res.m - planet.res.m, 1);
    expect(made.c).toBeCloseTo(saved.res.c - planet.res.c, 1);
    expect(made.d).toBeCloseTo(saved.res.d - planet.res.d, 1);
    const research = settleR(ctx.players.get('u_Anna')!, planet.t).research;
    const f = prod(planet, ctx.admin.universe(), research).f;
    expect(made.f).toBe(Math.round(f * 1000) / 1000);
    expect(made.f).toBeGreaterThan(0);
    expect(made).not.toHaveProperty('built');
    expect(made).not.toHaveProperty('units');
    expect(Object.keys(made).sort()).toEqual(
      ['c', 'd', 'f', 'from', 'm', 'owner', 'place', 'to'].sort(),
    );
  });

  /** Anna's place with `over`, saved `ms` later in a cause that ended with a read; the prod of that event. */
  function spanOf(over: object, ms: number): JournalAction['prod'] {
    const ctx = setup();
    const planet = addPlanet(ctx, 'u_Anna', {
      res: { m: 0, c: 0, d: 0 },
      ...over,
    });
    ctx.clock.t += ms;
    beginCause();
    ctx.planets.save({ ...planet, t: ctx.now() });
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    return (payloads(ctx)[0] as unknown as JournalAction).prod;
  }
  const mines = { metal: 0, crystal: 0, deut: 0, solar: 30 };

  it('records a span that credited only one resource', () => {
    // 100 ms: the base income of metal and crystal rounds to 0.00 and only the mine counts.
    for (const [only, key] of [
      ['m', 'metal'],
      ['c', 'crystal'],
      ['d', 'deut'],
    ] as const) {
      const made = spanOf({ b: { ...mines, [key]: 30 } }, 100)?.[0];
      expect(made, only).toMatchObject({
        m: 0,
        c: 0,
        d: 0,
        ...{ [only]: made?.[only] },
      });
      expect(made![only], only).toBeGreaterThan(0);
      for (const other of (['m', 'c', 'd'] as const).filter((x) => x !== only))
        expect(made![other], only).toBe(0);
    }
  });

  it('records nothing when a span produced, finished and built nothing', () => {
    expect(spanOf({ b: {} }, 1)).toBeUndefined();
  });

  it('records a finished building when nothing else changed, and not a running one', () => {
    const queue = (end: number) => ({
      key: 'metal',
      lvl: 1,
      start: 0,
      end,
      cost: [10, 20, 30],
    });
    const t0 = testCtx().now();
    expect(spanOf({ b: {}, bq: queue(t0 + HOUR) }, 1)).toBeUndefined();
    const made = spanOf({ b: {}, bq: queue(t0 + 1) }, 1)?.[0];
    expect(made).toMatchObject({ m: 0, c: 0, d: 0 });
    expect(made!.built).toEqual({
      key: 'metal',
      lvl: 1,
      end: t0 + 1,
      cost: [10, 20, 30],
    });
  });

  it('records the units a shipyard finished when nothing else changed', () => {
    const made = spanOf(
      {
        b: { yard: 1 },
        sq: [{ key: 'rl', n: 1, unit: 1 }],
        sqT: testCtx().now(),
      },
      5,
    )?.[0];
    expect(made).toMatchObject({ m: 0, c: 0, d: 0, units: { rl: 1 } });
    expect(made).not.toHaveProperty('built');
  });

  it('records only the units that were added, per ships and defense', () => {
    const ctx = setup();
    const start = ctx.now();
    const { planet } = advanced(
      ctx,
      {
        b: { yard: 1 },
        pct: { metal: 0, crystal: 0, deut: 0 },
        res: { m: 0, c: 0, d: 0 },
        ships: { sc: 4 },
        def: { rl: 1, ll: 0 },
        sq: [{ key: 'rl', n: 2, unit: HOUR / 4 }],
        sqT: start,
      },
      0,
    );
    ctx.clock.t = start + 24 * HOUR;
    beginCause();
    ctx.planets.save({ ...planet, t: ctx.now() });
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    const made = (payloads(ctx)[0] as unknown as JournalAction).prod![0]!;
    expect(made.units).toEqual({ rl: 2 });
  });

  it('records a finished building once: a second save at the same or an earlier time adds nothing', () => {
    const ctx = setup();
    const t0 = ctx.now();
    const planet = addPlanet(ctx, 'u_Anna', {
      b: {},
      bq: { key: 'metal', lvl: 1, start: 0, end: t0 + 1, cost: [1, 2, 3] },
    });
    const at = (t: number) => ({ ...planet, t });
    beginCause();
    ctx.planets.save(at(t0 + HOUR));
    ctx.planets.save(at(t0 + HOUR));
    ctx.planets.save(at(t0 + HOUR / 2));
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    const made = (payloads(ctx)[0] as unknown as JournalAction).prod;
    expect(made).toHaveLength(1);
    expect(made![0]!.built).toMatchObject({ key: 'metal', lvl: 1 });
  });

  it('notes nothing for a save that does not advance the place, for a new place, and outside a cause', () => {
    const ctx = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { planet, later } = advanced(ctx);
    const read = vi.spyOn(Object.getPrototypeOf(ctx.planets), 'get');
    // Outside a cause the previous state is not even read.
    ctx.planets.save(later);
    expect(read).not.toHaveBeenCalled();
    beginCause();
    // The same time and an earlier one: nothing produced.
    ctx.planets.save({ ...later });
    ctx.planets.save({ ...later, t: later.t - 500 });
    // A place that is new has no previous state.
    ctx.planets.save({ ...planet, id: 'p1_1_9', p: 9, t: later.t + HOUR });
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    expect((payloads(ctx)[0] as unknown as JournalAction).prod).toBeUndefined();
    expect(err).not.toHaveBeenCalled();
  });
});

describe('the reports a cause wrote', () => {
  it('lists each report with its type and the seat of its receiver, and the battle once', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { p: 5 });
    addPlanet(ctx, 'u_Bert', { p: 6, s: 2 });
    const facts = {
      rounds: 3,
      winner: 'att',
      attBefore: { lf: 2 },
      attAfter: { lf: 1 },
      defBefore: { rl: 2 },
      defAfter: { rl: 0 },
      rebuilt: { rl: 1 },
      loot: { m: 1, c: 2, d: 3 },
      debris: { m: 4, c: 5, d: 6 },
    };
    beginCause();
    ctx.reports.add('u_Anna', report({ id: 'r1', ...facts, name: 'Alpha' }), 9);
    ctx.reports.add(
      'u_Bert',
      report({ id: 'r2', rounds: 99, winner: 'def' }),
      9,
    );
    journalAction(ctx, ctx.players.get('u_Anna')!, 'read', {});
    const p = payloads(ctx)[0] as unknown as JournalAction & {
      battle?: unknown;
    };
    expect(p.reports).toEqual([
      { id: 'r1', type: 'battle', to: 1 },
      { id: 'r2', type: 'battle', to: 2 },
    ]);
    expect(p).not.toHaveProperty('battle');
    // The battle is part of an arrival event, with the nine numbers and no name.
    const f = fleetFor(ctx);
    beginCause();
    ctx.reports.add('u_Anna', report({ id: 'r3', ...facts, name: 'Alpha' }), 9);
    ctx.reports.add('u_Bert', report({ id: 'r4', rounds: 99 }), 9);
    journalFleet(ctx, EVENT_KIND.arrival, f, ctx.now(), fleetBefore(ctx, f));
    const [a] = payloads(ctx, EVENT_KIND.arrival);
    expect(a!.battle).toEqual(facts);
    expect(a!.reports).toEqual([
      { id: 'r3', type: 'battle', to: 1 },
      { id: 'r4', type: 'battle', to: 2 },
    ]);
  });

  it('copies only the facts that exist, and takes no battle from another kind of report', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { p: 5 });
    const f = fleetFor(ctx);
    beginCause();
    ctx.reports.add('u_Anna', report({ id: 's1', type: 'spy', rounds: 5 }), 9);
    ctx.reports.add('u_Anna', report({ id: 'b1', rounds: 2 }), 9);
    ctx.reports.add('u_Anna', report({ id: 'b2', rounds: 7 }), 9);
    journalFleet(ctx, EVENT_KIND.arrival, f, ctx.now(), fleetBefore(ctx, f));
    const [a] = payloads(ctx, EVENT_KIND.arrival);
    expect(a!.battle).toEqual({ rounds: 2 });
    beginCause();
    ctx.reports.add('u_Anna', report({ id: 's2', type: 'spy', rounds: 5 }), 9);
    journalFleet(ctx, EVENT_KIND.arrival, f, ctx.now(), fleetBefore(ctx, f));
    expect(payloads(ctx, EVENT_KIND.arrival)[1]).not.toHaveProperty('battle');
  });

  it('notes no report outside a cause and logs no error for it', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { p: 5 });
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    ctx.reports.add('u_Anna', report(), 9);
    expect(err).not.toHaveBeenCalled();
  });
});

describe('the refusal of an action', () => {
  it('stores the input with the seat of an account and not its id', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { p: 5 });
    addPlanet(ctx, 'u_Bert', { p: 6, s: 2 });
    journalRefusal(
      ctx,
      'u_Anna',
      'answerFriend',
      { type: 'answerFriend', uid: 'u_Bert', accept: true },
      'Nein.',
    );
    expect(payloads(ctx)).toEqual([
      {
        cause: 'answerFriend',
        input: { uid: 2, accept: true },
        ok: false,
        msg: 'Nein.',
      },
    ]);
  });

  it('hides names of two characters and longer, keeps a one-character name, and cuts at 200', () => {
    const ctx = setup();
    addUser(ctx, 'Q');
    addPlanet(ctx, 'u_Anna', { p: 5 });
    journalRefusal(
      ctx,
      'u_Anna',
      'read',
      { type: 'read' },
      'Jo grüßt Q und Bert.',
    );
    const long = 'z'.repeat(250);
    journalRefusal(ctx, 'u_Anna', 'read', { type: 'read' }, long);
    const [a, b] = payloads(ctx) as { msg: string }[];
    expect(a!.msg).toBe('… grüßt Q und ….');
    expect(b!.msg).toBe('z'.repeat(200));
  });

  it('hides a typed text of two characters, but leaves a single character alone', () => {
    const ctx = setup();
    addPlanet(ctx, 'u_Anna', { p: 5 });
    journalRefusal(
      ctx,
      'u_Anna',
      'rename',
      { type: 'rename', name: 'xy', planet: 'p1_1_5' },
      'xy ist kein x-beliebiger Name p1_1_5.',
    );
    journalRefusal(
      ctx,
      'u_Anna',
      'rename',
      { type: 'rename', name: 'x' },
      'x bleibt stehen.',
    );
    const [a, b] = payloads(ctx) as { msg: string }[];
    expect(a!.msg).toBe('… ist kein x-beliebiger Name p1_1_5.');
    expect(b!.msg).toBe('x bleibt stehen.');
  });

  it('writes nothing for an account that is unknown, and does not throw', () => {
    const ctx = setup();
    expect(() =>
      journalRefusal(ctx, 'u_Nobody', 'read', { type: 'read' }, 'x'),
    ).not.toThrow();
    expect(payloads(ctx)).toEqual([]);
  });
});

/** A fleet of Anna on its way to the place of Bert, saved. */
function fleetFor(ctx: TestCtx, over: Partial<Fleet> = {}): Fleet {
  if (!ctx.planets.get('p1_2_6')) addPlanet(ctx, 'u_Bert', { p: 6, s: 2 });
  if (!ctx.planets.get('p1_1_5')) addPlanet(ctx, 'u_Anna', { p: 5 });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'p1_2_6',
    toC: { g: 1, s: 2, p: 6 },
    mission: 'transport',
    ships: { sc: 2 },
    cargo: { m: 5, c: 1, d: 0 },
    dep: 0,
    arr: 9e12,
    ret: 9e12,
    state: 'out',
    recalled: false,
    fuel: 0,
    ...over,
  };
  ctx.fleets.save(f);
  return f;
}

describe('the event of a fleet', () => {
  it('records the fleet, its ships and cargo as they were, the target seat and the time given', () => {
    const ctx = setup();
    const f = fleetFor(ctx);
    const before = fleetBefore(ctx, f);
    // The fleet changes after `tick` looked at it: the event keeps what it was.
    f.ships.sc = 0;
    f.cargo.m = 0;
    journalFleet(ctx, EVENT_KIND.arrival, f, 12345, before);
    const [e] = events(ctx, EVENT_KIND.arrival);
    expect(e).toMatchObject({ seat: 1, at: 12345, recorded: ctx.now() });
    expect(e!.payload).toEqual({
      cause: 'arrival',
      mission: 'transport',
      fleet: 'f1',
      from: 'p1_1_5',
      to: 'p1_2_6',
      target: 2,
      ships: { sc: 2 },
      cargo: { m: 5, c: 1, d: 0 },
      fate: 'out',
    });
  });

  it('names the cause by the kind: arrival, hold, return', () => {
    const ctx = setup();
    const f = fleetFor(ctx);
    for (const kind of [EVENT_KIND.hold, EVENT_KIND.return])
      journalFleet(ctx, kind, f, 1, fleetBefore(ctx, f));
    expect(payloads(ctx, EVENT_KIND.hold)[0]!.cause).toBe('hold');
    expect(payloads(ctx, EVENT_KIND.return)[0]!.cause).toBe('return');
  });

  it('has no target seat for a target without an owner', () => {
    const ctx = setup();
    const f = fleetFor(ctx, { to: 'p9_9_9' });
    expect(fleetBefore(ctx, f).target).toBeNull();
    journalFleet(ctx, EVENT_KIND.arrival, f, 1, fleetBefore(ctx, f));
    expect(payloads(ctx, EVENT_KIND.arrival)[0]!.target).toBeNull();
  });

  it('records the fate: out, back, hold, or gone', () => {
    const ctx = setup();
    const fate = (state: Fleet['state'] | null): unknown => {
      const f = fleetFor(ctx);
      const before = fleetBefore(ctx, f);
      if (state === null) ctx.fleets.delete(f.id);
      else ctx.fleets.save({ ...f, state });
      journalFleet(ctx, EVENT_KIND.arrival, f, 1, before);
      return payloads(ctx, EVENT_KIND.arrival).at(-1)!.fate;
    };
    expect(fate('out')).toBe('out');
    expect(fate('back')).toBe('back');
    expect(fate('hold')).toBe('hold');
    expect(fate(null)).toBe('gone');
  });

  it('lists the production and the reports of its cause only when there are some', () => {
    const ctx = setup();
    const f = fleetFor(ctx);
    journalFleet(ctx, EVENT_KIND.arrival, f, 1, fleetBefore(ctx, f));
    expect(payloads(ctx, EVENT_KIND.arrival)[0]).not.toHaveProperty('prod');
    expect(payloads(ctx, EVENT_KIND.arrival)[0]).not.toHaveProperty('reports');
    const { later } = advanced(ctx, { p: 8 });
    beginCause();
    ctx.planets.save(later);
    ctx.reports.add('u_Anna', report({ type: 'info' }), 9);
    journalFleet(ctx, EVENT_KIND.arrival, f, 1, fleetBefore(ctx, f));
    const second = payloads(ctx, EVENT_KIND.arrival)[1] as unknown as {
      prod: unknown[];
      reports: unknown[];
      battle?: unknown;
    };
    expect(second.prod).toHaveLength(1);
    expect(second.reports).toEqual([{ id: 'r1', type: 'info', to: 1 }]);
    expect(second).not.toHaveProperty('battle');
  });
});
