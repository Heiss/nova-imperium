// The journal of the round, version 2 (#235): the research that finished, a
// colony or a moon that came or went, what the units had cost, the gift of the
// Endzeit marked as one, and the closing settlement. Driven directly like
// journal-causes.test.ts; the flow through the real actions is in
// journal.test.ts.
import { afterEach, describe, expect, it } from 'vitest';
import {
  EVENT_KIND,
  EVENT_VERSION,
  type JournalClose,
  type JournalFleet,
  type PlaceChanged,
  type ResearchDone,
} from '../../core/round-events.ts';
import type { Fleet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { ROUND_EVENT } from './round-archive.ts';
import {
  beginCause,
  dropCause,
  fleetBefore,
  journalAction,
  journalClose,
  journalFleet,
  causePending,
} from './journal.ts';

const HOUR = 3600000;

afterEach(() => dropCause());

function setup(): TestCtx {
  const ctx = testCtx();
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, b: { solar: 8, metal: 3 } });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6 });
  return ctx;
}

const events = (ctx: TestCtx, kind: string) => ctx.rounds.events(1, kind);
const payloads = <T>(ctx: TestCtx, kind: string): T[] =>
  events(ctx, kind).map((e) => e.payload as unknown as T);
const read = (ctx: TestCtx, who = 'Anna') =>
  journalAction(ctx, ctx.players.get(`u_${who}`)!, 'read', {});

describe('the version of the events', () => {
  it('is 2 for everything the journal writes now', () => {
    expect(EVENT_VERSION).toBe(2);
    const ctx = setup();
    beginCause();
    read(ctx);
    expect(events(ctx, EVENT_KIND.action).map((e) => e.version)).toEqual([2]);
  });
});

describe('research.done', () => {
  /** Anna with a research that is due `due` ms after now, saved with the research as given. */
  function finish(
    due: number,
    saved: Record<string, number>,
    at: number | null = null,
  ): TestCtx {
    const ctx = setup();
    const anna = ctx.players.get('u_Anna')!;
    const end = ctx.now() + due;
    anna.rq = {
      key: 'energy',
      lvl: 2,
      start: ctx.now() - HOUR,
      end,
      cost: [100, 200, 300],
    };
    ctx.players.save(anna);
    ctx.clock.t += HOUR;
    beginCause(at);
    ctx.players.save({ ...anna, research: saved, rq: null });
    read(ctx);
    return ctx;
  }

  it('is written at its logical end, with its level, cost and the cause that noticed it', () => {
    const ctx = finish(HOUR / 2, { energy: 2 });
    const [e] = events(ctx, EVENT_KIND.research);
    expect(e).toMatchObject({
      seat: 1,
      at: 1_000_000 + HOUR / 2,
      recorded: ctx.now(),
      version: 2,
    });
    expect(e!.payload).toEqual({
      key: 'energy',
      lvl: 2,
      end: 1_000_000 + HOUR / 2,
      cost: [100, 200, 300],
      cause: 'read',
    } satisfies ResearchDone);
  });

  it('is not written for a research that the save cancelled', () => {
    expect(events(finish(HOUR / 2, {}), EVENT_KIND.research)).toEqual([]);
  });

  it('is not written for one that is not due yet', () => {
    const ctx = finish(2 * HOUR, { energy: 2 });
    expect(events(ctx, EVENT_KIND.research)).toEqual([]);
  });

  it('is judged at the logical time of a fleet: a research the gift overtook did not finish', () => {
    const ctx = finish(HOUR / 2, { energy: 2 }, 1_000_000 + HOUR / 4);
    expect(events(ctx, EVENT_KIND.research)).toEqual([]);
  });

  it('is not written outside a cause, and not twice', () => {
    const ctx = setup();
    const anna = ctx.players.get('u_Anna')!;
    anna.rq = { key: 'energy', lvl: 2, start: 0, end: 5, cost: [1, 1, 1] };
    ctx.players.save(anna);
    const done = { ...anna, research: { energy: 2 }, rq: null };
    ctx.players.save(done);
    expect(events(ctx, EVENT_KIND.research)).toEqual([]);
    beginCause();
    ctx.players.save(done);
    read(ctx);
    expect(events(ctx, EVENT_KIND.research)).toEqual([]);
  });
});

describe('place.created and place.removed', () => {
  const place = (ctx: TestCtx, over: object) =>
    addPlanet(ctx, 'u_Anna', { g: 2, s: 3, p: 4, ...over });

  it('writes a colony of a player who has a place, with its coordinates and the cause', () => {
    const ctx = setup();
    beginCause();
    place(ctx, {});
    journalAction(ctx, ctx.players.get('u_Anna')!, 'send', { type: 'send' });
    const [e] = events(ctx, EVENT_KIND.created);
    expect(e).toMatchObject({ seat: 1, at: ctx.now(), version: 2 });
    expect(e!.payload).toEqual({
      place: 'p2_3_4',
      kind: 'planet',
      g: 2,
      s: 3,
      p: 4,
      cause: 'send',
    } satisfies PlaceChanged);
  });

  it('writes a moon, also when it is the first place of the owner', () => {
    const ctx = setup();
    addUser(ctx, 'Cleo');
    beginCause();
    addPlanet(ctx, 'u_Cleo', { g: 3, s: 3, p: 3, kind: 'moon' });
    read(ctx);
    expect(payloads<PlaceChanged>(ctx, EVENT_KIND.created)).toEqual([
      expect.objectContaining({ kind: 'moon', place: 'p3_3_3' }),
    ]);
  });

  it('writes nothing for the first place of an owner: that is their joining', () => {
    const ctx = setup();
    addUser(ctx, 'Cleo');
    beginCause();
    addPlanet(ctx, 'u_Cleo', { g: 3, s: 3, p: 3 });
    read(ctx);
    expect(events(ctx, EVENT_KIND.created)).toEqual([]);
  });

  it('writes nothing when a place that exists is saved again, or outside a cause', () => {
    const ctx = setup();
    place(ctx, {});
    expect(events(ctx, EVENT_KIND.created)).toEqual([]);
    beginCause();
    ctx.planets.save({ ...ctx.planets.get('p2_3_4')!, name: 'X' });
    read(ctx);
    expect(events(ctx, EVENT_KIND.created)).toEqual([]);
  });

  it('writes the removal at the logical time of the cause and counts the last span of production', () => {
    const ctx = setup();
    const gone = place(ctx, {
      b: { solar: 8, metal: 3 },
      res: { m: 0, c: 0, d: 0 },
    });
    ctx.clock.t += 2 * HOUR;
    beginCause(ctx.now() - HOUR);
    ctx.planets.delete(gone.id);
    read(ctx);
    const [e] = events(ctx, EVENT_KIND.removed);
    expect(e).toMatchObject({ seat: 1, at: ctx.now() - HOUR });
    expect(e!.payload).toMatchObject({ place: gone.id, cause: 'read' });
    const prod = (
      events(ctx, EVENT_KIND.action)[0]!.payload as {
        prod: { place: string; to: number; m: number }[];
      }
    ).prod;
    expect(prod).toEqual([
      expect.objectContaining({
        place: gone.id,
        from: gone.t,
        to: ctx.now() - HOUR,
      }),
    ]);
    expect(prod[0]!.m).toBeGreaterThan(0);
    expect(ctx.planets.get(gone.id)).toBeNull();
  });

  it('deletes a place the journal never saw as a plain delete', () => {
    const ctx = setup();
    const gone = place(ctx, {});
    ctx.planets.delete(gone.id);
    expect(events(ctx, EVENT_KIND.removed)).toEqual([]);
    expect(ctx.planets.get(gone.id)).toBeNull();
  });
});

describe('what a finished unit and a demolition record', () => {
  it('records the cost of the finished units, ships and defense apart', () => {
    const ctx = setup();
    const yard = addPlanet(ctx, 'u_Anna', {
      g: 1,
      s: 1,
      p: 6,
      b: { yard: 1 },
      sq: [
        { key: 'rl', n: 2, unit: 1000 },
        { key: 'lt', n: 3, unit: 1000 },
      ],
      sqT: 1_000_000,
    });
    ctx.clock.t += 24 * HOUR;
    beginCause();
    ctx.planets.save({ ...yard, t: ctx.now() });
    read(ctx);
    const prod = (
      events(ctx, EVENT_KIND.action)[0]!.payload as {
        prod: {
          units: object;
          unitsCost: { ships?: number[]; def?: number[] };
        }[];
      }
    ).prod[0]!;
    expect(prod.units).toEqual({ rl: 2, lt: 3 });
    expect(prod.unitsCost.def).toHaveLength(3);
    expect(prod.unitsCost.ships).toHaveLength(3);
    expect(prod.unitsCost.def!.some((n) => n > 0)).toBe(true);
    expect(prod.unitsCost.ships!.some((n) => n > 0)).toBe(true);
  });

  it('records what the end of a demolition gave back', () => {
    const ctx = setup();
    const p = ctx.planets.get('p1_1_5')!;
    ctx.planets.save({
      ...p,
      bq: {
        key: 'metal',
        lvl: 2,
        start: p.t,
        end: p.t + HOUR,
        cost: [0, 0, 0],
        back: [10, 5, 0],
      },
    });
    ctx.clock.t += 2 * HOUR;
    beginCause();
    ctx.planets.save({ ...ctx.planets.get('p1_1_5')!, t: ctx.now() });
    read(ctx);
    const built = (
      events(ctx, EVENT_KIND.action)[0]!.payload as {
        prod: { built: object }[];
      }
    ).prod[0]!.built;
    expect(built).toEqual({
      key: 'metal',
      lvl: 2,
      end: 1_000_000 + HOUR,
      cost: [0, 0, 0],
      back: [10, 5, 0],
    });
  });
});

describe('the gift of the Endzeit', () => {
  const fleet = (over: Partial<Fleet>): Fleet => ({
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'p1_1_5',
    toC: { g: 1, s: 1, p: 5 },
    mission: 'deploy',
    ships: { lt: 42 },
    cargo: { m: 1_000_000, c: 1_000_000, d: 1_000_000 },
    dep: 0,
    arr: 5,
    ret: 10,
    state: 'out',
    recalled: false,
    fuel: 0,
    ...over,
  });

  it('is marked on the arrival of a gift fleet and on no other', () => {
    const ctx = setup();
    for (const gift of [true, undefined]) {
      const f = fleet({ gift });
      beginCause(5);
      journalFleet(ctx, EVENT_KIND.arrival, f, 5, fleetBefore(ctx, f));
    }
    const marks = payloads<JournalFleet>(ctx, EVENT_KIND.arrival).map(
      (p) => 'gift' in p && p.gift,
    );
    expect(marks).toEqual([true, false]);
  });
});

describe('the closing settlement', () => {
  it('settles the places to the cutoff, writes what they produced and the research that finished', () => {
    const ctx = setup();
    const anna = ctx.players.get('u_Anna')!;
    anna.rq = {
      key: 'energy',
      lvl: 1,
      start: ctx.now(),
      end: ctx.now() + HOUR,
      cost: [1, 2, 3],
    };
    ctx.players.save(anna);
    const before = ctx.planets.get('p1_1_5')!;
    ctx.clock.t += 3 * HOUR;
    journalClose(ctx, ctx.now());
    const [close] = payloads<JournalClose>(ctx, EVENT_KIND.close);
    expect(close!.cause).toBe('close');
    expect(close!.prod!.map((p) => p.place).sort()).toEqual([
      'p1_1_5',
      'p1_2_6',
    ]);
    expect(close!.prod!.every((p) => p.to === ctx.now())).toBe(true);
    expect(close!.prod!.find((p) => p.place === 'p1_1_5')!.m).toBeGreaterThan(
      0,
    );
    // The game is the same: the places are saved at the cutoff, the research is in the row.
    expect(ctx.planets.get('p1_1_5')!.t).toBe(ctx.now());
    expect(ctx.planets.get('p1_1_5')!.res.m).toBeGreaterThan(before.res.m);
    expect(ctx.players.get('u_Anna')).toMatchObject({
      research: { energy: 1 },
      rq: null,
    });
    const [done] = payloads<ResearchDone>(ctx, EVENT_KIND.research);
    expect(done).toMatchObject({ key: 'energy', lvl: 1, cause: 'close' });
    expect(events(ctx, EVENT_KIND.close)[0]).toMatchObject({
      seat: null,
      at: ctx.now(),
      version: 2,
    });
  });

  it('leaves a research alone that is not due at the cutoff', () => {
    const ctx = setup();
    const anna = ctx.players.get('u_Anna')!;
    anna.rq = {
      key: 'energy',
      lvl: 1,
      start: ctx.now(),
      end: ctx.now() + 5 * HOUR,
      cost: [1, 2, 3],
    };
    ctx.players.save(anna);
    ctx.clock.t += HOUR;
    journalClose(ctx, ctx.now());
    expect(ctx.players.get('u_Anna')!.rq).not.toBeNull();
    expect(events(ctx, EVENT_KIND.research)).toEqual([]);
  });

  it('is written even when nothing was produced, and keeps the cause that is collecting', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    beginCause(7);
    journalClose(ctx, ctx.now());
    expect(causePending()).toBe(true);
    expect(payloads<JournalClose>(ctx, EVENT_KIND.close)).toEqual([
      { cause: 'close' },
    ]);
  });

  it('is written by the close of the round, before its events, and the count includes it', async () => {
    const ctx = setup();
    const { closeActiveRound } = await import('./round-archive.ts');
    ctx.clock.t += 2 * HOUR;
    closeActiveRound(ctx);
    const kinds = ctx.db
      .prepare('SELECT kind FROM round_events ORDER BY id')
      .pluck()
      .all() as string[];
    expect(kinds.indexOf(EVENT_KIND.close)).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf(EVENT_KIND.close)).toBeLessThan(
      kinds.indexOf(ROUND_EVENT.player),
    );
    expect(ctx.rounds.get(1)!.events).toBe(ctx.rounds.countEvents(1));
  });
});
