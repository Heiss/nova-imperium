// Expedition (#93, okf/features/expeditions.md): any ships with level 1 of
// Kreuzzugs-Kartografie fly to the expedition position of a system, stay the
// hours the player chose, and meet an event: nothing, a find of resources or
// of ships, a battle, the loss of the fleet or a change of the return time.
// The events are on with the shares of the owner (2026-11-19, EVENT_SHARES),
// so no test lets chance decide: each hands the event or the generator in.
import { describe, expect, it } from 'vitest';
import { battle } from '../../../core/battle.ts';
import {
  distance,
  fleetSpeed,
  flightMs,
  fuelFor,
} from '../../../core/flight.ts';
import {
  EVENT_KINDS,
  EVENT_SHARES,
  type EventKind,
  earlyReturn,
  lateReturn,
  raidFleet,
  raiderTech,
  stayOf,
} from '../../../core/expedition.ts';
import { MISSION, sendError } from '../../../core/missions.ts';
import { seeded } from '../../../test/fixtures.ts';
import type { Coords, Fleet, Levels } from '../../../core/types.ts';
import { universe } from '../../../server/game/context.ts';
import { arrive, comeHome, tick } from '../../../server/game/arrival.ts';
import { heldAt, holdersAt } from '../../../server/game/holding.ts';
import { dueAt } from '../../../core/holding.ts';
import { ABANDON_ERROR } from '../../../server/game/abandon.ts';
import { runAction } from '../../../server/game/dispatch.ts';
import { recall, send } from '../../../server/game/fleet-actions.ts';
import { categoryScores } from '../../../server/game/highscore.ts';
import { destroyMoon, addMoon } from '../../../server/game/moons.ts';
import {
  type TestCtx,
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../../../server/test-helpers.ts';
import { expedition, onArrive, WORDS } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend, maxStay } from './rules.ts';

const HOME = { g: 1, s: 1, p: 5 };
const SPOT: Coords = { g: 1, s: 2, p: 16 };
const HOUR = 3_600_000;
const START = 1_000_000_000;

/** A generator that gives the numbers in turn and then fails: every draw is accounted for. */
function queue(...values: number[]): () => number {
  const rest = [...values];
  return () => {
    if (!rest.length) throw new Error('more draws than expected');
    return rest.shift()!;
  };
}

/** Anna with Kreuzzugs-Kartografie at `level` and a planet with ships, and Bert with a planet. */
function world(level = 4, ships: Levels = { lc: 100, sc: 10, probe: 5 }) {
  const ctx = testCtx(START, 21);
  const anna = addUser(ctx, 'Anna', { research: { expo: level, computer: 3 } });
  addUser(ctx, 'Bert');
  addPlanet(ctx, anna.id, { ...HOME, name: 'Heim', ships });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 6, name: 'Beta' });
  return { ctx, anna };
}

/** What the player sends: `stay` hours to the expedition position, or `to`. */
const order = (over: Record<string, unknown> = {}) => ({
  planet: 'p1_1_5',
  mission: 'expedition',
  ships: { lc: 10 },
  to: SPOT,
  pct: 10,
  hold: 1,
  ...over,
});

const go = (ctx: TestCtx, over: Record<string, unknown> = {}) =>
  send(ctx, ctx.players.get('u_Anna')!, order(over));

/** An expedition that has stayed its hours: `arr` is now, the flight home takes `flight`. */
function stayed(
  ctx: TestCtx,
  ships: Levels,
  { stay = 2 * HOUR, flight = 3 * HOUR, id = 'f1', fuel = 100 } = {},
): Fleet {
  const f: Fleet = {
    id,
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: HOME,
    to: 'p1_2_16',
    toC: SPOT,
    mission: 'expedition',
    ships,
    cargo: { m: 0, c: 0, d: 0 },
    dep: ctx.now() - flight - stay,
    arr: ctx.now(),
    ret: ctx.now() + flight,
    state: 'out',
    recalled: false,
    fuel,
  };
  ctx.fleets.save(f);
  return f;
}

const reports = (ctx: TestCtx) =>
  ctx.reports.ofPlayer('u_Anna').map((r) => [r.title, r.text]);

const audit = (ctx: TestCtx) =>
  ctx.db
    .prepare(
      "SELECT category, actor, target, outcome, detail FROM audit_events WHERE action = 'expedition'",
    )
    .all();

describe('the rules of the mission', () => {
  it('flies to the expedition position without cargo, comes home with a report and holds nothing', () => {
    expect(rules).toMatchObject({
      order: 110,
      target: 'expedition',
      cargo: false,
      returns: true,
      silent: false,
      alertsGuild: false,
      holds: false,
    });
    expect(MISSION.expedition).toBe('Expedition');
  });

  it('needs level 1 of the research, then as many expeditions as the root of the level', () => {
    const fleet = (level: number | undefined, running?: number) => ({
      owner: 'a',
      from: 'p1',
      ships: { lc: 1 },
      ...(level === undefined ? {} : { research: { expo: level } }),
      ...(running === undefined ? {} : { running }),
    });
    expect(canSend({ owner: 'a', from: 'p1', ships: {} })).toBe(
      'expeditionLocked',
    );
    expect(canSend(fleet(undefined))).toBe('expeditionLocked');
    expect(canSend(fleet(0))).toBe('expeditionLocked');
    expect(canSend({ ...fleet(0), research: { expo: 0, spy: 9 } })).toBe(
      'expeditionLocked',
    );
    expect(canSend(fleet(1))).toBeUndefined();
    expect(canSend(fleet(1, 0))).toBeUndefined();
    expect(canSend(fleet(1, 1))).toBe('expeditionSlots');
    expect(canSend(fleet(3, 0))).toBeUndefined();
    expect(canSend(fleet(3, 1))).toBe('expeditionSlots');
    expect(canSend(fleet(4, 1))).toBeUndefined();
    expect(canSend(fleet(4, 2))).toBe('expeditionSlots');
    expect(canSend(fleet(9, 2))).toBeUndefined();
    expect(canSend(fleet(9, 3))).toBe('expeditionSlots');
    expect(canSend(fleet(9, 7))).toBe('expeditionSlots');
  });

  it('stays at most as many hours as the level times the hours per level of the round', () => {
    expect(maxStay({ expo: 4 })).toBe(4);
    expect(maxStay({ expo: 1 })).toBe(1);
    expect(maxStay({})).toBe(0);
    expect(maxStay({ spy: 5 })).toBe(0);
    expect(maxStay({ expo: 4 }, 3)).toBe(12);
    expect(maxStay({ expo: 1 }, 24)).toBe(24);
    expect(maxStay({}, 24)).toBe(0);
  });

  it('is checked after the position: a planet position is no target, the expedition position is', () => {
    const ok = { owner: 'a', from: 'p1', ships: {}, research: { expo: 1 } };
    const target = {
      planet: null,
      debris: false,
      protects: () => false,
      vacation: () => false,
    };
    const rule = {
      order: 1,
      target: rules.target,
      cargo: rules.cargo,
      returns: rules.returns,
      silent: rules.silent,
      alertsGuild: rules.alertsGuild,
      holds: rules.holds,
      canSend,
    };
    expect(
      sendError(rule, ok, { ...target, expedition: true }),
    ).toBeUndefined();
    expect(sendError(rule, ok, target)).toBe('notExpedition');
    expect(sendError(rule, { ...ok, research: {} }, target)).toBe(
      'notExpedition',
    );
    expect(
      sendError(rule, { ...ok, research: {} }, { ...target, expedition: true }),
    ).toBe('expeditionLocked');
  });
});

describe('sending an expedition', () => {
  it('flies to the position after the last planet position and stays the chosen hours', () => {
    const { ctx } = world();
    expect(go(ctx, { stay: 3 })).toBe('Flotte unterwegs nach [1:2:16].');
    const dist = distance(HOME, SPOT);
    const ms = flightMs(
      dist,
      fleetSpeed({ lc: 10 }, { research: ctx.players.get('u_Anna')!.research }),
      10,
      universe(ctx),
    );
    const [f] = ctx.fleets.all();
    expect(f).toMatchObject({
      mission: 'expedition',
      to: 'p1_2_16',
      toC: SPOT,
      ships: { lc: 10 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: START,
      arr: START + ms + 3 * HOUR,
      ret: START + 2 * ms + 3 * HOUR,
      state: 'out',
      recalled: false,
      fuel: fuelFor({ lc: 10 }, dist, 10),
    });
    expect(stayOf(f!)).toBe(3 * HOUR);
    // The fuel is burnt, the ships are away.
    expect(ctx.planets.get('p1_1_5')!.ships).toEqual({
      lc: 90,
      sc: 10,
      probe: 5,
    });
    expect(ctx.planets.get('p1_1_5')!.res.d).toBe(100000 - f!.fuel);
  });

  it('stays an hour when no time is given, and a whole number of hours at least 1', () => {
    for (const stay of [undefined, 0, -3, 'x', null, 1.9, 0.2]) {
      const { ctx } = world();
      go(ctx, { stay });
      expect(stayOf(ctx.fleets.all()[0]!), String(stay)).toBe(HOUR);
    }
    const { ctx } = world();
    go(ctx, { stay: '3' });
    expect(stayOf(ctx.fleets.all()[0]!)).toBe(3 * HOUR);
  });

  it('refuses a stay longer than the level and names the most', () => {
    const { ctx } = world(4);
    expect(() => go(ctx, { stay: 5 })).toThrow(
      'Die Haltezeit beträgt höchstens 4 Stunden.',
    );
    expect(() => go(ctx, { stay: 1e9 })).toThrow(
      'Die Haltezeit beträgt höchstens 4 Stunden.',
    );
    expect(ctx.fleets.all()).toEqual([]);
    expect(ctx.planets.get('p1_1_5')!.ships.lc).toBe(100);
    go(ctx, { stay: 4 });
    expect(stayOf(ctx.fleets.all()[0]!)).toBe(4 * HOUR);
    const one = world(1);
    expect(() => go(one.ctx, { stay: 2 })).toThrow(
      'Die Haltezeit beträgt höchstens 1 Stunde.',
    );
  });

  /** The values of the round the admin changed (owner, 2026-11-19), as the universe settings store them. */
  const setRound = (ctx: TestCtx, over: Record<string, number>): void =>
    ctx.admin.saveUniverse({ ...universe(ctx), ...over });

  it('stays at most level times the hours per level of the round, and names that most', () => {
    const { ctx } = world(4);
    setRound(ctx, { roundExpeditionHours: 6 });
    expect(() => go(ctx, { stay: 25 })).toThrow(
      'Die Haltezeit beträgt höchstens 24 Stunden.',
    );
    expect(ctx.fleets.all()).toEqual([]);
    go(ctx, { stay: 24 });
    expect(stayOf(ctx.fleets.all()[0]!)).toBe(24 * HOUR);
    // At the highest setting a level 1 expedition stays 24 hours.
    const one = world(1);
    setRound(one.ctx, { roundExpeditionHours: 24 });
    expect(() => go(one.ctx, { stay: 25 })).toThrow(
      'Die Haltezeit beträgt höchstens 24 Stunden.',
    );
    go(one.ctx, { stay: 24 });
    expect(stayOf(one.ctx.fleets.all()[0]!)).toBe(24 * HOUR);
  });

  it('allows the extra places of the round on top of the root of the level, not without the research', () => {
    const { ctx, anna } = world(4);
    setRound(ctx, { roundExpeditionExtraSlots: 2 });
    // Level 4: two places and two more; the fleet slots limit too (Kogitator-Doktrin 3: four).
    for (let i = 0; i < 4; i++) go(ctx);
    expect(() => go(ctx)).toThrow('Alle Flottenslots belegt.');
    ctx.players.save({ ...anna, research: { expo: 4, computer: 9 } });
    expect(() => go(ctx)).toThrow('Alle Expeditionsplätze belegt.');
    // Without the research no extra place helps.
    ctx.players.save({ ...anna, research: { computer: 9 } });
    expect(() => go(ctx)).toThrow(
      'Expeditionen erst mit Kreuzzugs-Kartografie.',
    );
  });

  it('divides the stay by the universe speed only when the round says so, and keeps the flights as they are', () => {
    const real = world(5);
    go(real.ctx, { stay: 5 });
    const off = real.ctx.fleets.all()[0]!;
    expect(stayOf(off)).toBe(5 * HOUR);
    const fast = world(5);
    setRound(fast.ctx, { roundExpeditionSpeed: 1 });
    const speed = universe(fast.ctx).speed;
    go(fast.ctx, { stay: 5 });
    const on = fast.ctx.fleets.all()[0]!;
    expect(stayOf(on)).toBe(Math.round((5 * HOUR) / speed));
    // The flight out and home are the same in both rounds.
    expect(on.ret - on.arr).toBe(off.ret - off.arr);
    expect(on.arr - on.dep - (on.ret - on.arr)).toBe(stayOf(on));
    // The limit is in the hours the player enters, not in the divided time.
    const limit = world(4);
    setRound(limit.ctx, { roundExpeditionSpeed: 1 });
    expect(() => go(limit.ctx, { stay: 5 })).toThrow(
      'Die Haltezeit beträgt höchstens 4 Stunden.',
    );
  });

  it('changes the return after an event from the real stay, divided or not', () => {
    const { ctx } = world(5);
    setRound(ctx, { roundExpeditionSpeed: 1 });
    go(ctx, { stay: 5 });
    const f = ctx.fleets.all()[0]!;
    const stay = stayOf(f);
    const flight = f.ret - f.arr;
    ctx.clock.t = f.arr;
    // A normal later return: the flight home takes the real stay times 2 longer.
    ctx.rng = queue(
      0.1,
      EVENT_SHARES.resources +
        EVENT_SHARES.ships +
        EVENT_SHARES.pirates +
        EVENT_SHARES.aliens +
        EVENT_SHARES.lost +
        EVENT_SHARES.early +
        0.01,
      0.5,
    );
    const expected = f.arr + flight + 2 * stay;
    arrive(ctx, f);
    expect(ctx.fleets.get(f.id)!.ret).toBe(expected);
  });

  it('needs the research', () => {
    for (const research of [
      {},
      { expo: 0 },
      { spy: 4, impulse: 3 },
    ] as Levels[]) {
      const { ctx, anna } = world();
      ctx.players.save({ ...anna, research });
      expect(() => go(ctx)).toThrow(
        'Expeditionen erst mit Kreuzzugs-Kartografie.',
      );
      expect(ctx.fleets.all()).toEqual([]);
    }
  });

  it('allows as many expeditions at once as the root of the level, out or back, and needs a fleet slot too', () => {
    // Level 4: two expeditions; Kogitator-Doktrin 3: four fleet slots.
    const { ctx } = world(4);
    go(ctx);
    go(ctx);
    expect(() => go(ctx)).toThrow('Alle Expeditionsplätze belegt.');
    // A fleet on its way home still holds its place.
    const [first] = ctx.fleets.all();
    ctx.fleets.save({ ...first!, state: 'back' });
    expect(() => go(ctx)).toThrow('Alle Expeditionsplätze belegt.');
    // Another mission does not hold one, and a fleet of the other player not either.
    const bert = ctx.fleets.all()[0]!;
    ctx.fleets.save({ ...bert, id: 'fb', owner: 'u_Bert' });
    expect(() => go(ctx)).toThrow('Alle Expeditionsplätze belegt.');
    ctx.fleets.delete(first!.id);
    go(ctx);
    expect(ctx.fleets.count('u_Anna')).toBe(2);
  });

  it('takes a normal fleet slot as well: with the slots full no expedition flies', () => {
    const { ctx, anna } = world(9);
    ctx.players.save({ ...anna, research: { expo: 9 } });
    go(ctx);
    expect(() => go(ctx)).toThrow('Alle Flottenslots belegt.');
  });

  it('does not count its slots in the fleets of other missions', () => {
    const { ctx } = world(4);
    ctx.fleets.save({
      ...stayed(ctx, { lc: 1 }),
      id: 'other',
      mission: 'transport',
    });
    ctx.fleets.delete('f1');
    go(ctx);
    go(ctx);
    expect(ctx.fleets.countMission('u_Anna', 'expedition')).toBe(2);
    expect(ctx.fleets.countMission('u_Anna', 'transport')).toBe(1);
    expect(ctx.fleets.countMission('u_Bert', 'expedition')).toBe(0);
  });

  it('flies only to the expedition position', () => {
    const { ctx } = world();
    for (const to of [{ g: 1, s: 2, p: 15 }, { g: 1, s: 2, p: 6 }, HOME])
      expect(() => go(ctx, { to })).toThrow(
        'Expeditionen fliegen nur zur Expeditionsposition.',
      );
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('flies to a position beyond the expedition position as to the expedition position itself', () => {
    const { ctx } = world();
    go(ctx, { to: { ...SPOT, p: 99 } });
    expect(ctx.fleets.all()[0]!.toC).toEqual(SPOT);
  });

  it('follows the size of the universe: 21 with 20 positions', () => {
    const { ctx } = world();
    ctx.admin.saveUniverse({ ...universe(ctx), positions: 20 });
    expect(() => go(ctx)).toThrow(
      'Expeditionen fliegen nur zur Expeditionsposition.',
    );
    go(ctx, { to: { ...SPOT, p: 21 } });
    expect(ctx.fleets.all()[0]).toMatchObject({
      toC: { g: 1, s: 2, p: 21 },
      to: 'p1_2_21',
    });
  });

  it('flies to no moon', () => {
    const { ctx } = world();
    expect(() => go(ctx, { to: { ...SPOT, kind: 'moon' } })).toThrow(
      'Ein Mond kann nicht das Ziel dieses Auftrags sein.',
    );
  });

  it('takes no cargo', () => {
    const { ctx } = world();
    go(ctx, { cargo: { m: 1000, c: 5, d: 5 } });
    expect(ctx.fleets.all()[0]!.cargo).toEqual({ m: 0, c: 0, d: 0 });
    expect(ctx.planets.get('p1_1_5')!.res.m).toBe(100000);
  });

  it('cannot colonize or survey the expedition position', () => {
    const { ctx, anna } = world();
    ctx.players.save({ ...anna, research: { ...anna.research, carto: 1 } });
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      ships: { colony: 1, probe: 3, lc: 5 },
    });
    expect(() =>
      go(ctx, { mission: 'colonize', ships: { colony: 1 } }),
    ).toThrow('Die Expeditionsposition kann nicht besiedelt werden.');
    expect(() => go(ctx, { mission: 'survey', ships: { probe: 1 } })).toThrow(
      'Die Expeditionsposition kann nicht besiedelt werden.',
    );
    for (const mission of ['attack', 'transport', 'spy', 'deploy'])
      expect(() => go(ctx, { mission, ships: { probe: 1 } }), mission).toThrow(
        'An dieser Position gibt es keinen Planeten.',
      );
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('does not change the Landnahme at a planet position', () => {
    const { ctx } = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      ships: { colony: 1, lc: 5 },
    });
    go(ctx, {
      mission: 'colonize',
      ships: { colony: 1 },
      to: { g: 1, s: 2, p: 9 },
    });
    expect(ctx.fleets.all()[0]).toMatchObject({ mission: 'colonize' });
  });
});

describe('recalling an expedition', () => {
  it('flies home as long as it has flown while it is on its way out', () => {
    const { ctx } = world();
    go(ctx, { stay: 2 });
    const f = ctx.fleets.all()[0]!;
    const ms = (f.ret - f.arr) as number;
    ctx.clock.t = START + Math.floor(ms / 2);
    recall(ctx, ctx.players.get('u_Anna')!, { id: f.id });
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      recalled: true,
      ret: START + 2 * Math.floor(ms / 2),
    });
  });

  it('flies home in one flight when it already stays at the position', () => {
    const { ctx } = world();
    go(ctx, { stay: 2 });
    const f = ctx.fleets.all()[0]!;
    const flight = f.ret - f.arr;
    // Halfway through the stay: the way back is the way out, not the time so far.
    ctx.clock.t = f.arr - HOUR;
    recall(ctx, ctx.players.get('u_Anna')!, { id: f.id });
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      recalled: true,
      ret: ctx.now() + flight,
    });
  });

  it('is no longer possible once the stay has ended', () => {
    const { ctx } = world();
    go(ctx);
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t = f.arr;
    expect(() => recall(ctx, ctx.players.get('u_Anna')!, { id: f.id })).toThrow(
      'Rückruf nicht mehr möglich.',
    );
  });

  it('keeps the flight home of every other mission as long as the flight so far', () => {
    const { ctx } = world();
    go(ctx, {
      mission: 'transport',
      to: { g: 1, s: 2, p: 6 },
      ships: { lc: 1 },
    });
    const f = ctx.fleets.all()[0]!;
    ctx.clock.t = START + 1000;
    recall(ctx, ctx.players.get('u_Anna')!, { id: f.id });
    expect(ctx.fleets.get(f.id)!.ret).toBe(START + 2000);
  });
});

describe('what an expedition meets', () => {
  it('finds nothing and comes home with its ships, the report and the audit entry', () => {
    const { ctx } = world();
    const f = stayed(ctx, { lc: 10 });
    expedition(ctx, f, { kind: 'nothing' });
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { lc: 10 },
      cargo: { m: 0, c: 0, d: 0 },
      ret: f.ret,
    });
    expect(reports(ctx)).toEqual([
      [
        'Expedition [1:2:16] – nichts entdeckt',
        'Die Expedition hat nichts Besonderes gefunden und kehrt heim.',
      ],
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      time: f.arr,
      type: 'info',
    });
    expect(audit(ctx)).toEqual([
      {
        category: 'system',
        actor: 'u_Anna',
        target: null,
        outcome: 'ok',
        detail: JSON.stringify({ fleet: 'f1', kind: 'nothing' }),
      },
    ]);
  });

  it('draws the event with the shares of the game: nothing for 16 % of the expeditions, and no draw after it', () => {
    for (const first of [0.84, 0.9, 0.9999]) {
      const { ctx } = world();
      ctx.rng = queue(first);
      onArrive(ctx, stayed(ctx, { lc: 10 }));
      expect(reports(ctx).map(([title]) => title)).toEqual([
        'Expedition [1:2:16] – nichts entdeckt',
      ]);
      expect(ctx.fleets.get('f1')!.state).toBe('back');
    }
  });

  /** The draw of the kind that lies in the middle of the range of `kind` among the shares of the game. */
  const middleOf = (kind: EventKind): number => {
    let upTo = 0;
    for (const k of EVENT_KINDS) {
      if (k === kind) return upTo + EVENT_SHARES[k] / 2;
      upTo += EVENT_SHARES[k];
    }
    throw new Error(kind);
  };

  it('loses the fleet when the draw falls to the total loss: no report of a find, the fleet is gone', () => {
    const { ctx } = world();
    ctx.rng = queue(0.1, middleOf('lost'));
    onArrive(ctx, stayed(ctx, { lc: 10 }));
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(reports(ctx).map(([title]) => title)).toEqual([
      'Expedition [1:2:16] – Flotte verloren',
    ]);
  });

  it('brings a later or an earlier return when the draw falls there, from the stay', () => {
    const late = world();
    late.ctx.rng = queue(0.1, middleOf('late'), 0.5);
    const f = stayed(late.ctx, { lc: 10 });
    // The fleet object is changed by the arrival: the expected time comes first.
    const lateAt = lateReturn(f.arr, f.ret - f.arr, stayOf(f), 'normal');
    onArrive(late.ctx, f);
    expect(late.ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ret: lateAt,
    });
    expect(reports(late.ctx)[0]![0]).toBe(
      'Expedition [1:2:16] – Rückkehr später',
    );
    const early = world();
    early.ctx.rng = queue(0.1, middleOf('early'), 0.5);
    const g = stayed(early.ctx, { lc: 10 });
    const earlyAt = earlyReturn(g.arr, g.ret - g.arr, stayOf(g), 'normal');
    onArrive(early.ctx, g);
    expect(early.ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ret: earlyAt,
    });
    expect(reports(early.ctx)[0]![0]).toBe(
      'Expedition [1:2:16] – Rückkehr früher',
    );
  });

  it('draws the size of the event after its kind, as 89, 10 and 1 %', () => {
    const sizes = ['normal', 'large', 'huge'] as const;
    const pick = [0.5, 0.95, 0.995];
    pick.forEach((r, i) => {
      const { ctx } = world();
      ctx.rng = queue(0.1, middleOf('late'), r);
      const f = stayed(ctx, { lc: 10 });
      const expected = lateReturn(f.arr, f.ret - f.arr, stayOf(f), sizes[i]!);
      onArrive(ctx, f);
      expect(ctx.fleets.get('f1')!.ret, sizes[i]).toBe(expected);
    });
  });

  it('arrives through the dispatcher at the expedition position, and turns back from any other', () => {
    const { ctx } = world();
    ctx.rng = queue(0.99);
    arrive(ctx, stayed(ctx, { lc: 10 }));
    expect(ctx.fleets.get('f1')!.state).toBe('back');
    expect(reports(ctx)[0]![0]).toBe('Expedition [1:2:16] – nichts entdeckt');
    for (const toC of [
      { g: 1, s: 2, p: 15 },
      { g: 1, s: 2, p: 17 },
      { g: 3, s: 2, p: 16 },
      { g: 1, s: 51, p: 16 },
    ]) {
      const other = testCtx(START, 21);
      addUser(other, 'Anna', { research: { expo: 4 } });
      addPlanet(other, 'u_Anna', { ...HOME, ships: { lc: 10 } });
      const f2 = { ...stayed(other, { lc: 10 }), toC };
      other.fleets.save(f2);
      arrive(other, f2);
      expect(other.fleets.get('f1')!.state).toBe('back');
      expect(other.reports.ofPlayer('u_Anna').map((r) => r.title)).toEqual([
        'Flotte kehrt um',
      ]);
    }
  });

  it('turns back when the universe grew and the position became a planet position', () => {
    const { ctx } = world();
    ctx.admin.saveUniverse({ ...universe(ctx), positions: 16 });
    arrive(ctx, stayed(ctx, { lc: 10 }));
    expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.title)).toEqual([
      'Flotte kehrt um',
    ]);
  });

  describe('a find of resources', () => {
    it('loads Adamant, Psikristall or Promethium into the holds, by the size and the base number', () => {
      // lc: 100 are 6,000 expedition points, capped at 2,400 by a rank-1 player under 100,000 points.
      const cases = [
        ['normal', [0.5, 0.1], 'm', 72_000, 'einen kleinen'],
        ['large', [0.5, 0.6], 'c', (76 / 2) * 2400, 'einen großen'],
        ['huge', [0.5, 0.9], 'd', (150 / 3) * 2400, 'einen sehr großen'],
      ] as const;
      for (const [size, draws, res, amount, words] of cases) {
        const { ctx } = world();
        ctx.rng = queue(...draws);
        expedition(ctx, stayed(ctx, { lc: 100 }), { kind: 'resources', size });
        const name = { m: 'Adamant', c: 'Psikristall', d: 'Promethium' }[res];
        expect(ctx.fleets.get('f1')!.cargo, size).toEqual({
          m: 0,
          c: 0,
          d: 0,
          [res]: amount,
        });
        expect(reports(ctx), size).toEqual([
          [
            'Expedition [1:2:16] – Rohstofffund',
            `Die Expedition hat ${words} Rohstofffund gemacht: ${amount.toLocaleString('de-DE')} ${name} kommen mit der Flotte heim.`,
          ],
        ]);
        expect(audit(ctx), size).toMatchObject([
          { detail: JSON.stringify({ fleet: 'f1', kind: 'resources', size }) },
        ]);
      }
    });

    it('takes at most what the holds carry after half the fuel', () => {
      const { ctx } = world();
      ctx.rng = queue(0.5, 0.1);
      // One Frachtläufer carries 5,000; the fuel of 1,000 costs 500 of it.
      expedition(ctx, stayed(ctx, { sc: 1 }, { fuel: 1000 }), {
        kind: 'resources',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.cargo.m).toBe(4500);
      expect(reports(ctx)[0]![1]).toBe(
        'Die Expedition hat einen kleinen Rohstofffund gemacht: 4.500 Adamant kommen mit der Flotte heim.',
      );
    });

    it('says so when nothing fits', () => {
      const { ctx } = world();
      ctx.rng = queue(0.5, 0.1);
      expedition(ctx, stayed(ctx, { sc: 1 }, { fuel: 10_000 }), {
        kind: 'resources',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.cargo).toEqual({ m: 0, c: 0, d: 0 });
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Rohstofffund',
          'Die Expedition hat Rohstoffe gefunden, aber ihre Laderäume sind zu klein, um etwas davon mitzunehmen.',
        ],
      ]);
    });

    it('scales with the points of the best player: more points, bigger finds', () => {
      const { ctx } = world();
      addUser(ctx, 'Carl');
      // Millions of points in Carl's research: the cap of rank 1 is 12,000.
      addPlanet(ctx, 'u_Carl', {
        g: 2,
        s: 1,
        p: 5,
        ships: { dstar: 1000 },
      });
      ctx.rng = queue(0.5, 0.1);
      expedition(ctx, stayed(ctx, { lc: 100 }), {
        kind: 'resources',
        size: 'normal',
      });
      // 6,000 points of the fleet, the cap of the tier: 30 · 6,000.
      expect(ctx.fleets.get('f1')!.cargo.m).toBe(180_000);
    });

    it('adds to what the fleet carries', () => {
      const { ctx } = world();
      ctx.rng = queue(0.5, 0.1);
      const f = stayed(ctx, { lc: 100 });
      ctx.fleets.save({ ...f, cargo: { m: 5, c: 6, d: 7 } });
      expedition(ctx, ctx.fleets.get('f1')!, {
        kind: 'resources',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.cargo).toEqual({ m: 72_005, c: 6, d: 7 });
    });

    it('is paid out when the fleet is home: Adamant on the planet and the report of the return', () => {
      const { ctx } = world();
      ctx.rng = queue(0.5, 0.1);
      expedition(ctx, stayed(ctx, { lc: 100 }), {
        kind: 'resources',
        size: 'normal',
      });
      const back = ctx.fleets.get('f1')!;
      ctx.clock.t = back.ret;
      comeHome(ctx, back);
      expect(ctx.planets.get('p1_1_5')!.res.m).toBe(100000 + 72_000);
      expect(ctx.reports.ofPlayer('u_Anna').map((r) => r.title)).toContain(
        'Rückkehr zu Heim [1:1:5]',
      );
    });
  });

  describe('a find of ships', () => {
    it('adds the found ships to the fleet', () => {
      const { ctx } = world();
      ctx.rng = queue(0, 0.5, 0.99, 0, 0.99);
      expedition(ctx, stayed(ctx, { lc: 10 }), {
        kind: 'ships',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.ships).toEqual({ lc: 10, lf: 2, probe: 2 });
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Schiffsfund',
          'Die Expedition hat einen kleinen Schiffsfund gemacht, die Schiffe schließen sich der Flotte an: 2 Abfangjäger, 2 Spähschädel.',
        ],
      ]);
      expect(audit(ctx)).toMatchObject([
        {
          detail: JSON.stringify({
            fleet: 'f1',
            kind: 'ships',
            size: 'normal',
          }),
        },
      ]);
    });

    it('lands the ships on the planet with the fleet, and counts them for the fleet score', () => {
      const { ctx } = world();
      const before = categoryScores(ctx).u_Anna!.fleet;
      ctx.rng = queue(0, 0.5, 0.99, 0, 0.99);
      expedition(ctx, stayed(ctx, { lc: 10 }), {
        kind: 'ships',
        size: 'normal',
      });
      // The ten ships away count for the fleet (#78) and now four more.
      expect(categoryScores(ctx).u_Anna!.fleet).toBe(before + 10 + 4);
      const back = ctx.fleets.get('f1')!;
      ctx.clock.t = back.ret;
      comeHome(ctx, back);
      expect(ctx.planets.get('p1_1_5')!.ships).toEqual({
        lc: 110,
        sc: 10,
        probe: 7,
        lf: 2,
      });
    });

    it('says so when it found no ship, and a fleet that finds nothing is left as it is', () => {
      const { ctx } = world();
      ctx.rng = queue();
      expedition(ctx, stayed(ctx, { colony: 2, recycler: 1 }), {
        kind: 'ships',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.ships).toEqual({ colony: 2, recycler: 1 });
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Schiffsfund',
          'Die Expedition hat nach Schiffen gesucht, aber keine gefunden, die sich der Flotte anschließen.',
        ],
      ]);
    });
  });

  describe('a battle with pirates or aliens', () => {
    /** The battle as the arrival fights it, from the same draws. */
    function expected(
      raider: 'pirates' | 'aliens',
      size: 'normal' | 'large' | 'huge',
      ships: Levels,
      tech: Levels,
      seed: number,
    ) {
      const rng = seeded(seed);
      const foes = raidFleet(rng, raider, size, ships);
      const foeTech = raiderTech(raider, tech);
      const res = battle(
        { units: foes, tech: foeTech },
        { units: ships, tech },
        rng,
      );
      return { foes, foeTech, res };
    }

    it('fights as the defender against the raiders and flies home with what is left', () => {
      const tech = { weapons: 5, shield: 4, armor: 3 };
      for (const [raider, size] of [
        ['pirates', 'normal'],
        ['aliens', 'large'],
        ['pirates', 'huge'],
      ] as const) {
        const ships = { cr: 20, lc: 30, probe: 4 };
        const { ctx, anna } = world();
        ctx.players.save({ ...anna, research: { ...anna.research, ...tech } });
        ctx.rng = seeded(77);
        expedition(ctx, stayed(ctx, ships), { kind: raider, size });
        const { foes, foeTech, res } = expected(raider, size, ships, tech, 77);
        const report = ctx.reports.ofPlayer('u_Anna')[0]!;
        expect(report, raider).toMatchObject({
          type: 'battle',
          participants: ['u_Anna'],
          name: 'Expeditionsposition',
          coords: SPOT,
          attName: raider === 'pirates' ? 'Piraten' : 'Aliens',
          defName: 'Anna',
          rounds: res.rounds,
          winner: res.winner,
          attBefore: foes,
          attAfter: res.att,
          defBefore: ships,
          defAfter: res.def,
          rebuilt: {},
          attTech: foeTech,
          defTech: tech,
        });
        const result = {
          att: 'verloren',
          def: 'gewonnen',
          draw: 'unentschieden',
        }[res.winner];
        expect(report.title).toBe(`Kampfbericht [1:2:16] – ${result}`);
        expect(report.time).toBe(START);
        if (Object.keys(res.def).length)
          expect(ctx.fleets.get('f1')).toMatchObject({
            state: 'back',
            ships: res.def,
          });
        else expect(ctx.fleets.get('f1')).toBeNull();
        expect(audit(ctx), raider).toMatchObject([
          { detail: JSON.stringify({ fleet: 'f1', kind: raider, size }) },
        ]);
      }
    });

    it('leaves the debris of the ships of both sides at the expedition position', () => {
      const { ctx } = world();
      ctx.rng = seeded(5);
      const ships = { cr: 20, lc: 30 };
      expedition(ctx, stayed(ctx, ships), { kind: 'aliens', size: 'huge' });
      const { foes, res } = expected('aliens', 'huge', ships, {}, 5);
      let m = 0;
      let c = 0;
      const lost = (
        before: Levels,
        after: Levels,
        cost: Record<string, number[]>,
      ) => {
        for (const [k, n] of Object.entries(before)) {
          const gone = n - (after[k] ?? 0);
          m += gone * cost[k]![0]!;
          c += gone * cost[k]![1]!;
        }
      };
      const cost: Record<string, number[]> = {
        cr: [20000, 7000],
        lc: [6000, 6000],
        bs: [45000, 15000],
        bc: [30000, 40000],
        dr: [60000, 50000],
        lf: [3000, 1000],
        hf: [6000, 4000],
        sc: [2000, 2000],
        probe: [0, 1000],
      };
      lost(foes, res.att, cost);
      lost(ships, res.def, cost);
      const field = ctx.debris.get('d1_2_16');
      expect(m + c).toBeGreaterThan(0);
      expect(field).toMatchObject({ g: 1, s: 2, p: 16 });
      expect(field!.m).toBeCloseTo(m * 0.3, 6);
      expect(field!.c).toBeCloseTo(c * 0.3, 6);
      const report = ctx.reports.ofPlayer('u_Anna')[0]!;
      expect(report.debris).toEqual({ m: field!.m, c: field!.c });
    });

    it('adds to the field that is already there', () => {
      const { ctx } = world();
      ctx.debris.add(SPOT, { m: 1000, c: 500 });
      ctx.rng = seeded(5);
      expedition(ctx, stayed(ctx, { cr: 20, lc: 30 }), {
        kind: 'aliens',
        size: 'huge',
      });
      const field = ctx.debris.get('d1_2_16')!;
      const report = ctx.reports.ofPlayer('u_Anna')[0]!.debris as {
        m: number;
        c: number;
      };
      expect(field.m).toBeCloseTo(1000 + report.m, 6);
      expect(field.c).toBeCloseTo(500 + report.c, 6);
    });

    it('is lost when the raiders destroy the whole fleet: no flight home, the debris stays', () => {
      const { ctx } = world();
      ctx.rng = seeded(1);
      expedition(ctx, stayed(ctx, { probe: 1 }), {
        kind: 'aliens',
        size: 'huge',
      });
      expect(ctx.fleets.get('f1')).toBeNull();
      const report = ctx.reports.ofPlayer('u_Anna')[0]!;
      expect(report).toMatchObject({
        type: 'battle',
        winner: 'att',
        attName: 'Aliens',
        defAfter: {},
      });
      expect(report.title).toBe('Kampfbericht [1:2:16] – verloren');
      // 30 % of the 1,000 Psikristall of the Spähschädel.
      expect(ctx.debris.get('d1_2_16')).toMatchObject({ m: 0, c: 300 });
    });

    it('leaves no field when nothing is destroyed', () => {
      // A fleet of Weltenbrecher against a handful of pirates loses nothing: the
      // pirates are destroyed, so there is debris, but only theirs.
      const { ctx } = world();
      ctx.rng = seeded(3);
      expedition(ctx, stayed(ctx, { dstar: 3 }), {
        kind: 'pirates',
        size: 'normal',
      });
      expect(ctx.fleets.get('f1')!.ships).toEqual({ dstar: 3 });
      const report = ctx.reports.ofPlayer('u_Anna')[0]!;
      expect(report.winner).toBe('def');
      expect(report.title).toBe('Kampfbericht [1:2:16] – gewonnen');
      // The 5 Abfangjäger and 30 % of the Weltenbrecher were destroyed by the three.
      expect(ctx.debris.get('d1_2_16')).not.toBeNull();
    });

    it('pushes the report as an event of the fleet', () => {
      const { ctx } = world();
      subscribePush(ctx, 'u_Anna');
      ctx.rng = seeded(3);
      expedition(ctx, stayed(ctx, { dstar: 3 }), {
        kind: 'pirates',
        size: 'normal',
      });
      expect(queuedPushes(ctx)).toEqual([
        { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
      ]);
    });
  });

  describe('the loss of the fleet', () => {
    it('deletes the fleet with its ships and reports it', () => {
      const { ctx } = world();
      expedition(ctx, stayed(ctx, { lc: 10 }), { kind: 'lost' });
      expect(ctx.fleets.get('f1')).toBeNull();
      expect(ctx.fleets.all()).toEqual([]);
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Flotte verloren',
          'Von der Expedition kam nur noch ein abgerissener Funkspruch. Die Flotte ist verloren.',
        ],
      ]);
      expect(audit(ctx)).toMatchObject([
        { detail: JSON.stringify({ fleet: 'f1', kind: 'lost' }) },
      ]);
      // The ships are gone: the planet got none back.
      expect(ctx.planets.get('p1_1_5')!.ships).toEqual({
        lc: 100,
        sc: 10,
        probe: 5,
      });
    });
  });

  describe('a change of the return time', () => {
    const fleet = (ctx: TestCtx) =>
      stayed(ctx, { lc: 10 }, { stay: 3 * HOUR, flight: 4 * HOUR });
    const returns = (ctx: TestCtx) => ctx.fleets.get('f1')!.ret - ctx.now();

    it('delays the return by the stay times 2, 3 or 5', () => {
      for (const [size, factor] of [
        ['normal', 2],
        ['large', 3],
        ['huge', 5],
      ] as const) {
        const { ctx } = world();
        expedition(ctx, fleet(ctx), { kind: 'late', size });
        expect(returns(ctx), size).toBe(4 * HOUR + 3 * HOUR * factor);
        expect(ctx.fleets.get('f1')).toMatchObject({
          state: 'back',
          ships: { lc: 10 },
        });
      }
      const { ctx } = world();
      expedition(ctx, fleet(ctx), { kind: 'late', size: 'normal' });
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Rückkehr später',
          'Die Expedition hat sich verirrt und kehrt später als geplant zurück.',
        ],
      ]);
    });

    it('shortens the flight home by a third of the stay times 2, 3 or 5, and no more than to a second', () => {
      for (const [size, factor] of [
        ['normal', 2],
        ['large', 3],
        ['huge', 5],
      ] as const) {
        const { ctx } = world();
        expedition(ctx, fleet(ctx), { kind: 'early', size });
        expect(returns(ctx), size).toBe(
          Math.max(1000, 4 * HOUR - (3 * HOUR * factor) / 3),
        );
      }
      const { ctx } = world();
      expedition(ctx, fleet(ctx), { kind: 'early', size: 'huge' });
      // 4 hours − 5 hours is below a second: the flight home takes one.
      expect(returns(ctx)).toBe(1000);
      expect(reports(ctx)).toEqual([
        [
          'Expedition [1:2:16] – Rückkehr früher',
          'Die Expedition hat einen kürzeren Weg gefunden und kehrt früher als geplant zurück.',
        ],
      ]);
    });

    it('is the time of the fleet that comes home, and the report of its return comes then', () => {
      const { ctx } = world();
      expedition(ctx, fleet(ctx), { kind: 'late', size: 'normal' });
      const f = ctx.fleets.get('f1')!;
      expect(ctx.fleets.due(f.ret - 1)).toEqual([]);
      expect(ctx.fleets.due(f.ret).map((x) => x.id)).toEqual(['f1']);
    });
  });

  it('knows its own words, so the reports of the owner can be told apart (WORDS)', () => {
    expect(WORDS).toEqual({
      nothing: 'Die Expedition hat nichts Besonderes gefunden und kehrt heim.',
      noRoom:
        'Die Expedition hat Rohstoffe gefunden, aber ihre Laderäume sind zu klein, um etwas davon mitzunehmen.',
      noShips:
        'Die Expedition hat nach Schiffen gesucht, aber keine gefunden, die sich der Flotte anschließen.',
      lost: 'Von der Expedition kam nur noch ein abgerissener Funkspruch. Die Flotte ist verloren.',
      late: 'Die Expedition hat sich verirrt und kehrt später als geplant zurück.',
      early:
        'Die Expedition hat einen kürzeren Weg gefunden und kehrt früher als geplant zurück.',
    });
  });
});

describe('an expedition and the other rules of the game', () => {
  it('lets the Bergung harvest the debris at the expedition position (Q5)', () => {
    const { ctx } = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      ships: { recycler: 5, lc: 20 },
    });
    expect(() =>
      go(ctx, { mission: 'harvest', ships: { recycler: 5 }, stay: undefined }),
    ).toThrow('An dieser Position gibt es kein Trümmerfeld.');
    ctx.debris.add(SPOT, { m: 1000, c: 500 });
    go(ctx, { mission: 'harvest', ships: { recycler: 5 } });
    const f = ctx.fleets.all()[0]!;
    expect(f).toMatchObject({ mission: 'harvest', to: 'd1_2_16', toC: SPOT });
    // No stay: the Bergung is no expedition.
    expect(stayOf(f)).toBe(0);
    ctx.clock.t = f.arr;
    arrive(ctx, f);
    expect(ctx.fleets.get(f.id)).toMatchObject({
      state: 'back',
      cargo: { m: 1000, c: 500, d: 0 },
    });
    expect(ctx.debris.get('d1_2_16')).toBeNull();
  });

  it('does not let any other mission stay: the hours chosen are ignored', () => {
    const { ctx } = world();
    go(ctx, {
      mission: 'transport',
      to: { g: 1, s: 2, p: 6 },
      ships: { lc: 1 },
      stay: 4,
    });
    expect(stayOf(ctx.fleets.all()[0]!)).toBe(0);
  });

  it('does not take the holding time of a Halten for the stay: only `stay` counts', () => {
    const { ctx } = world();
    go(ctx, { stay: undefined, hold: 4 });
    expect(stayOf(ctx.fleets.all()[0]!)).toBe(HOUR);
    // The expedition is no Halten: it keeps no holding time and burns no fuel for the stay.
    const f = ctx.fleets.all()[0]!;
    expect(f.hold).toBeUndefined();
    expect(f.fuel).toBe(fuelFor({ lc: 10 }, distance(HOME, SPOT), 10));
  });

  it('is no fleet that holds: no holder or defender at its position, no holding time, never the state hold (#55)', () => {
    const { ctx } = world();
    go(ctx, { stay: 3 });
    const f = ctx.fleets.all()[0]!;
    // It is a flight to the position, as any other.
    expect(ctx.fleets.at('p1_2_16').map((x) => x.id)).toEqual([f.id]);
    expect(heldAt(ctx, 'p1_2_16')).toEqual([]);
    expect(holdersAt(ctx, 'p1_2_16')).toEqual([]);
    // It does not defend the planet at the neighbouring position either.
    expect(heldAt(ctx, 'p1_2_6')).toEqual([]);
    expect(holdersAt(ctx, 'p1_2_6')).toEqual([]);
    expect(f.hold).toBeUndefined();
    // Staying at the position it is still out; at the end of the stay it flies home, it does not hold.
    ctx.clock.t = f.arr - 1;
    expect(ctx.fleets.get(f.id)).toMatchObject({ state: 'out' });
    ctx.rng = queue(0.99);
    ctx.clock.t = f.arr;
    tick(ctx);
    expect(ctx.fleets.get(f.id)).toMatchObject({ state: 'back' });
    expect(heldAt(ctx, 'p1_2_16')).toEqual([]);
  });

  it('does not end through the end of a holding time: the tick takes its arrival at the end of the stay and its return at the end of the flight home', () => {
    const { ctx } = world();
    go(ctx, { stay: 2 });
    const f = ctx.fleets.all()[0]!;
    const [arr, ret] = [f.arr, f.ret];
    expect(dueAt(f)).toBe(arr);
    ctx.clock.t = arr - 1;
    expect(tick(ctx)).toBe(0);
    ctx.rng = queue(0.99);
    ctx.clock.t = arr;
    expect(tick(ctx)).toBe(1);
    const back = ctx.fleets.get(f.id)!;
    expect(dueAt(back)).toBe(ret);
    ctx.clock.t = ret;
    expect(tick(ctx)).toBe(1);
    expect(ctx.fleets.get(f.id)).toBeNull();
    expect(ctx.planets.get('p1_1_5')!.ships.lc).toBe(100);
  });

  it('refuses to give up a colony an expedition started from while it flies', () => {
    const { ctx } = world();
    addPlanet(ctx, 'u_Anna', {
      g: 1,
      s: 1,
      p: 7,
      name: 'Kolonie',
      created: START + 5,
    });
    // From the colony, not from the home planet.
    ctx.planets.save({
      ...ctx.planets.get('p1_1_7')!,
      ships: { lc: 5 },
    });
    go(ctx, { planet: 'p1_1_7', ships: { lc: 5 } });
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'abandon',
        target: 'p1_1_7',
        created: START + 5,
        password: 'secret1',
      }),
    ).toThrow(ABANDON_ERROR.flights);
    expect(ctx.planets.get('p1_1_7')).not.toBeNull();
  });

  it('brings an expedition from a destroyed moon home to its planet (Mondbruch, #95)', () => {
    const { ctx } = world();
    const planet = ctx.planets.get('p1_1_5')!;
    const moon = addMoon(ctx, planet, 100, ctx.now());
    ctx.planets.save({
      ...moon,
      ships: { lc: 10 },
      res: { m: 0, c: 0, d: 100000 },
    });
    go(ctx, { planet: moon.id, ships: { lc: 10 } });
    const f = ctx.fleets.all()[0]!;
    expect(f.from).toBe(moon.id);
    destroyMoon(ctx, ctx.planets.get(moon.id)!);
    expect(ctx.fleets.get(f.id)).toMatchObject({
      from: 'p1_1_5',
      to: 'p1_2_16',
    });
    ctx.clock.t = f.arr;
    // No event: the generator is handed in.
    ctx.rng = queue(0.99);
    arrive(ctx, ctx.fleets.get(f.id)!);
    const back = ctx.fleets.get(f.id)!;
    ctx.clock.t = back.ret;
    comeHome(ctx, back);
    expect(ctx.planets.get('p1_1_5')!.ships.lc).toBe(100 + 10);
  });

  it('counts the ships of an expedition for the fleet score while it is away (#78)', () => {
    const { ctx } = world();
    const before = categoryScores(ctx).u_Anna!.fleet;
    go(ctx);
    expect(categoryScores(ctx).u_Anna!.fleet).toBe(before);
  });
});
