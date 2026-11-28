// Mondbruch (#95; owner, 2026-11-13 and 2026-11-16): only with a
// Weltenbrecher and only at a foreign moon; the battle of a Sturmangriff
// first, then, after a won battle or at an undefended moon, the two rolls
// (seeded draws); a broken moon takes everything on it, leaves no
// Trümmerfeld, and the fleets flying to it land at its planet.
import { describe, expect, it } from 'vitest';
import { sendError } from '../../../core/missions.ts';
import type { Fleet, Levels, Planet } from '../../../core/types.ts';
import { queuePush } from '../../../server/push-store.ts';
import { seeded } from '../../../test/fixtures.ts';
import { arrive, tick } from '../../../server/game/arrival.ts';
import { dueAt } from '../../../core/holding.ts';
import { heldAt, holdersAt } from '../../../server/game/holding.ts';
import { cutLoot } from '../../../server/game/fight.ts';
import { categoryScores } from '../../../server/game/highscore.ts';
import { addMoon, destroyMoon } from '../../../server/game/moons.ts';
import { pointsMap } from '../../../server/game/points.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

/** A generator that returns the given draws in turn, then fails. */
const draws = (...xs: number[]): (() => number) => {
  let i = 0;
  return () => {
    if (i >= xs.length) throw new Error('one draw too many');
    return xs[i++]!;
  };
};

const AT = { g: 1, s: 2, p: 6 };

function fleetTo(
  ctx: ReturnType<typeof testCtx>,
  over: Partial<Fleet> = {},
): Fleet {
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'm1_2_6',
    toC: AT,
    mission: 'moonbreak',
    ships: { dstar: 1 },
    cargo: { m: 0, c: 0, d: 100 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
    ...over,
  };
  ctx.fleets.save(f);
  return f;
}

/**
 * Anna sends a Mondbruch to the moon of Bert's planet Beta: 3,600 km, so one
 * Weltenbrecher breaks it with 40 % and is lost with 30 %.
 */
function setup(ships: Levels = { dstar: 1 }, moonOver: Partial<Planet> = {}) {
  const ctx = testCtx(1_000_000, 42);
  addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const planet = addPlanet(ctx, 'u_Bert', {
    ...AT,
    name: 'Beta',
    res: { m: 9000, c: 6000, d: 3000 },
  });
  const moon: Planet = {
    ...addMoon(ctx, planet, 1, 0),
    diameter: 3600,
    res: { m: 900, c: 600, d: 300 },
    ...moonOver,
  };
  ctx.planets.save(moon);
  const f = fleetTo(ctx, { ships });
  const att = { name: 'Anna', research: {}, rq: null };
  const def = { name: 'Bert', research: {}, rq: null };
  return { ctx, f, at: { t: moon, att, def } };
}

const anna = (ctx: ReturnType<typeof testCtx>) =>
  ctx.reports.ofPlayer('u_Anna')[0]!;
const bert = (ctx: ReturnType<typeof testCtx>) =>
  ctx.reports.ofPlayer('u_Bert')[0]!;
const count = (ctx: ReturnType<typeof testCtx>, table: string): number =>
  (
    ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE planet_id = ?`)
      .get('m1_2_6') as { n: number }
  ).n;

describe('moonbreak: the rules', () => {
  it('has its place, a foreign moon as target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 80,
      target: 'foreignMoon',
      cargo: true,
      returns: true,
      silent: false,
      alertsGuild: true,
    });
  });

  it('needs at least one Weltenbrecher; the other ships fly along', () => {
    const fleet = (ships: Levels) => ({ owner: 'a', from: 'p1', ships });
    expect(canSend(fleet({}))).toBe('noWorldbreaker');
    expect(canSend(fleet({ bs: 10, lc: 3 }))).toBe('noWorldbreaker');
    expect(canSend(fleet({ dstar: 0, bs: 1 }))).toBe('noWorldbreaker');
    expect(canSend(fleet({ dstar: 1 }))).toBeUndefined();
    expect(canSend(fleet({ dstar: 2, bs: 10, lc: 3 }))).toBeUndefined();
  });

  it('flies only to a foreign moon, then asks for the Weltenbrecher', () => {
    const fleet = { owner: 'a', from: 'p1', ships: { bs: 1 } };
    const at = (moon: boolean, owner = 'b') => ({
      planet: { id: 'm2', owner },
      debris: false,
      moon,
      protects: () => false,
      vacation: () => false,
    });
    expect(sendError(rules, fleet, at(false))).toBe('notMoon');
    expect(sendError(rules, fleet, at(true, 'a'))).toBe('ownTarget');
    expect(sendError(rules, fleet, at(true))).toBe('noWorldbreaker');
    expect(
      sendError(rules, { ...fleet, ships: { dstar: 1 } }, at(true)),
    ).toBeUndefined();
  });

  it('is refused at a player in vacation mode before anything else of the mission (#223, #95)', () => {
    const at = (vacation: boolean) => ({
      planet: { id: 'm2', owner: 'b' },
      debris: false,
      moon: true,
      protects: () => true,
      vacation: (owner: string) => vacation && owner === 'b',
    });
    const noShips = { owner: 'a', from: 'p1', ships: { bs: 1 } };
    const dstar = { ...noShips, ships: { dstar: 1 } };
    // The vacation comes before the noob protection and the Weltenbrecher.
    expect(sendError(rules, dstar, at(true))).toBe('vacation');
    expect(sendError(rules, noShips, at(true))).toBe('vacation');
    expect(sendError(rules, dstar, at(false))).toBe('protected');
    // A moon is no moon of a planet: the target kind is asked first.
    expect(sendError(rules, dstar, { ...at(true), moon: false })).toBe(
      'notMoon',
    );
  });
});

describe('moonbreak: the arrival', () => {
  it('breaks an undefended moon: everything on it is lost, no Trümmerfeld, the loot flies home', () => {
    const { ctx, f, at } = setup(
      { dstar: 1, lc: 2 },
      {
        b: { moonbase: 2, phalanx: 1 },
        bq: { key: 'moonbase', lvl: 3, start: 1, end: 2e9, cost: [1, 2, 3] },
        sq: [{ key: 'rl', n: 5, unit: 1000 }],
        sqT: 999_000,
        pct: { sat: 50 },
      },
    );
    // The undefended moon draws nothing in the battle: the moon breaks
    // (0.39 < 40 %), the Weltenbrecher stay (0.3 is not below 30 %).
    expect(count(ctx, 'shipyard_queue')).toBe(1);
    ctx.rng = draws(0.39, 0.3);
    onArrive(ctx, f, at);
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    for (const table of [
      'planet_buildings',
      'planet_units',
      'planet_production',
      'shipyard_queue',
    ])
      expect(count(ctx, table), table).toBe(0);
    // Its planet stays as it was.
    expect(ctx.planets.get('p1_2_6')!.res).toEqual({
      m: 9000,
      c: 6000,
      d: 3000,
    });
    expect(ctx.debris.all()).toEqual([]);
    const back = ctx.fleets.get('f1')!;
    expect(back.state).toBe('back');
    expect(back.ships).toEqual({ dstar: 1, lc: 2 });
    // The loot of a Sturmangriff: up to half of the moon's stock.
    expect(back.cargo).toEqual({ m: 450, c: 300, d: 250 });
    expect(anna(ctx)).toMatchObject({
      type: 'battle',
      title: 'Kampfbericht [1:2:6] – gewonnen',
      name: 'Mond (Mond)',
      winner: 'att',
      rounds: 0,
      loot: { m: 450, c: 300, d: 150 },
      moonbreak: { chance: 40, broken: true, loss: 30, lost: false },
    });
    expect(anna(ctx)).not.toHaveProperty('moonLost');
    expect(bert(ctx)).toMatchObject({
      title: 'Feindkontakt! Mond (Mond) [1:2:6] wird von Anna angegriffen',
      moonLost: true,
    });
    expect(bert(ctx)).not.toHaveProperty('moonbreak');
  });

  it('changes the highscore like an attack: the moon leaves the Wirtschaft of its owner, the lost Weltenbrecher the Militär of the attacker (#422, #95)', () => {
    const { ctx, f, at } = setup(
      { dstar: 1, lc: 2 },
      { b: { moonbase: 8, phalanx: 3 } },
    );
    const before = categoryScores(ctx);
    const total = pointsMap(ctx);
    expect(before.u_Bert!.economy.count).toBeGreaterThan(0);
    expect(before.u_Bert!.economy.points).toBeGreaterThan(0);
    expect(before.u_Anna!.military.count).toBe(3);
    // The moon breaks (0.39 < 40 %) and the Weltenbrecher are torn apart (0.2 < 30 %).
    ctx.rng = draws(0.39, 0.2);
    onArrive(ctx, f, at);
    const after = categoryScores(ctx);
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    expect(after.u_Bert!.economy).toEqual({ count: 0, points: 0 });
    expect(after.u_Anna!.military.count).toBe(2);
    expect(after.u_Anna!.military.points).toBeLessThan(
      before.u_Anna!.military.points,
    );
    expect(after.u_Anna!.economy).toEqual(before.u_Anna!.economy);
    expect(pointsMap(ctx).u_Bert!).toBeLessThan(total.u_Bert!);
    expect(pointsMap(ctx).u_Anna!).toBeLessThan(total.u_Anna!);
  });

  it('breaks a defended moon after a won battle: its ships and rebuilt defense are lost with it', () => {
    // Seven Weltenbrecher break a moon of 3,600 km for certain.
    const { ctx, f, at } = setup(
      { dstar: 7 },
      { ships: { sc: 3 }, def: { rl: 4 } },
    );
    ctx.rng = seeded(95);
    onArrive(ctx, f, at);
    const report = anna(ctx);
    expect(report).toMatchObject({
      winner: 'att',
      defBefore: { sc: 3, rl: 4 },
      moonbreak: { chance: 100, broken: true, loss: 30 },
    });
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    expect(count(ctx, 'planet_units')).toBe(0);
    // Only the Frachtläufer of the battle lie there: 30 % of 3 × 2,000 / 2,000.
    expect(report.debris).toEqual({ m: 1800, c: 1800 });
    expect(ctx.debris.all()).toEqual([
      { id: 'd1_2_6', g: 1, s: 2, p: 6, m: 1800, c: 1800 },
    ]);
  });

  it('keeps a moon that holds, and loses only the Weltenbrecher by their own shot', () => {
    const { ctx, f, at } = setup({ dstar: 2, lc: 2 });
    // √2 · 40 = 56.6 %: 0.6 misses; 0.29 < 30 % tears the Weltenbrecher.
    ctx.rng = draws(0.6, 0.29);
    onArrive(ctx, f, at);
    expect(ctx.planets.get('m1_2_6')).toMatchObject({
      res: { m: 450, c: 300, d: 150 },
    });
    const back = ctx.fleets.get('f1')!;
    expect(back.ships).toEqual({ lc: 2 });
    expect(back.cargo).toEqual({ m: 450, c: 300, d: 250 });
    expect(anna(ctx).moonbreak).toEqual({
      chance: 40 * Math.SQRT2,
      broken: false,
      loss: 30,
      lost: true,
    });
    // The lost Weltenbrecher leave no Trümmerfeld.
    expect(ctx.debris.all()).toEqual([]);
    expect(bert(ctx)).not.toHaveProperty('moonLost');
    expect(bert(ctx)).not.toHaveProperty('moonbreak');
  });

  it('cuts the loot to the holds left when the Weltenbrecher are lost; the rest is lost', () => {
    const rich = { res: { m: 100000, c: 100000, d: 100000 } };
    const { ctx, f, at } = setup({ dstar: 1, sc: 1 }, rich);
    f.cargo = { m: 200, c: 300, d: 100 };
    // The moon holds (0.5), the Weltenbrecher are torn apart (0).
    ctx.rng = draws(0.5, 0);
    onArrive(ctx, f, at);
    // The battle took half of everything ...
    expect(anna(ctx).loot).toEqual({ m: 50000, c: 50000, d: 50000 });
    expect(ctx.planets.get('m1_2_6')!.res).toEqual({
      m: 50000,
      c: 50000,
      d: 50000,
    });
    // ... the Frachtläufer takes 5,000 home, 600 of it its own cargo; the
    // 4,400 left are filled in the order of the loot.
    const back = ctx.fleets.get('f1')!;
    expect(back.ships).toEqual({ sc: 1 });
    expect(back.cargo).toEqual({ m: 1666, c: 1767, d: 1567 });
  });

  it('keeps the cargo the fleet carried when it still fits the holds left; the loot gets what is free (owner, 2026-11-18)', () => {
    const { ctx, f, at } = setup(
      { dstar: 1, sc: 1 },
      { res: { m: 0, c: 0, d: 0 } },
    );
    f.cargo = { m: 1000, c: 2000, d: 1500 };
    ctx.rng = draws(0.5, 0);
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')!.ships).toEqual({ sc: 1 });
    expect(ctx.fleets.get('f1')!.cargo).toEqual({ m: 1000, c: 2000, d: 1500 });
  });

  it('cuts the cargo the fleet carried to the holds left, in the order of the loot; the excess is lost and the loot gets nothing (owner, 2026-11-18)', () => {
    const rich = { res: { m: 100000, c: 100000, d: 100000 } };
    const { ctx, f, at } = setup({ dstar: 1, sc: 1 }, rich);
    // 9,000 carried, one Frachtläufer holds 5,000: a third Adamant, half of
    // the rest Psikristall, the rest Promethium.
    f.cargo = { m: 3000, c: 3000, d: 3000 };
    ctx.rng = draws(0.5, 0);
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')!.cargo).toEqual({ m: 1666, c: 1667, d: 1667 });
    expect(ctx.fleets.get('f1')!.ships).toEqual({ sc: 1 });
    // The report of the battle still shows the loot the battle took.
    expect(anna(ctx).loot).toEqual({ m: 50000, c: 50000, d: 50000 });
  });

  it('loses the carried cargo and the loot with the last ships: a fleet without ships carries nothing (owner, 2026-11-18)', () => {
    const rich = { res: { m: 100000, c: 100000, d: 100000 } };
    const { ctx, f, at } = setup({ dstar: 2 }, rich);
    f.cargo = { m: 500, c: 500, d: 500 };
    ctx.rng = draws(0, 0);
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('cuts nothing while the Weltenbrecher fly home', () => {
    const rich = { res: { m: 100000, c: 100000, d: 100000 } };
    const { ctx, f, at } = setup({ dstar: 1, sc: 1 }, rich);
    ctx.rng = draws(0.5, 0.5);
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')!.cargo).toEqual({
      m: 50000,
      c: 50000,
      d: 50100,
    });
  });

  it('cuts loot in the order of the classic loot, never below nothing', () => {
    const loot = { m: 900, c: 600, d: 300 };
    expect(cutLoot(loot, 1e9)).toEqual(loot);
    expect(cutLoot(loot, 300)).toEqual({ m: 100, c: 100, d: 100 });
    expect(cutLoot(loot, 0)).toEqual({ m: 0, c: 0, d: 0 });
    expect(cutLoot(loot, -50)).toEqual({ m: 0, c: 0, d: 0 });
    expect(cutLoot({ m: 0, c: 0, d: 30 }, 1000)).toEqual({ m: 0, c: 0, d: 30 });
  });

  it('a fleet of Weltenbrecher alone is gone with them, the moon broken too', () => {
    const { ctx, f, at } = setup({ dstar: 1 });
    ctx.rng = draws(0, 0);
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    expect(anna(ctx).moonbreak).toMatchObject({ broken: true, lost: true });
    expect(bert(ctx)).toMatchObject({ moonLost: true });
  });

  it('rolls nothing after a lost battle', () => {
    // A Weltenbrecher cannot beat 400 Plasmabatterien.
    const { ctx, f, at } = setup({ dstar: 1 }, { def: { pt: 400 } });
    onArrive(ctx, f, at);
    expect(anna(ctx).winner).not.toBe('att');
    expect(anna(ctx)).not.toHaveProperty('moonbreak');
    expect(bert(ctx)).not.toHaveProperty('moonLost');
    expect(ctx.planets.get('m1_2_6')).not.toBeNull();
    expect(
      ctx.db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'moonbreak'",
        )
        .get(),
    ).toEqual({ n: 0 });
  });

  it('rolls nothing after a draw, though the Weltenbrecher survive', () => {
    // Ten Plasmabatterien never pierce its shield, and it destroys one per
    // round: a draw after six rounds.
    const { ctx, f, at } = setup({ dstar: 1 }, { def: { pt: 10 } });
    onArrive(ctx, f, at);
    expect(anna(ctx)).toMatchObject({
      winner: 'draw',
      attAfter: { dstar: 1 },
    });
    expect(anna(ctx)).not.toHaveProperty('moonbreak');
    expect(ctx.planets.get('m1_2_6')).not.toBeNull();
  });

  it('rolls nothing without a Weltenbrecher left, even after a won battle', () => {
    const { ctx, f, at } = setup({ bs: 5 });
    ctx.rng = draws();
    onArrive(ctx, f, at);
    expect(anna(ctx).winner).toBe('att');
    expect(anna(ctx)).not.toHaveProperty('moonbreak');
    expect(ctx.planets.get('m1_2_6')).not.toBeNull();
  });

  it('fights the fleet and defense of the moon first; the battle leaves its Trümmerfeld', () => {
    // Ten Abfangjäger (3,000 / 1,000 / 0) die against the Weltenbrecher.
    const { ctx, f, at } = setup({ dstar: 1 }, { ships: { lf: 10 } });
    let n = 0;
    const rng = seeded(95);
    ctx.rng = () => {
      n++;
      return rng();
    };
    onArrive(ctx, f, at);
    expect(anna(ctx)).toMatchObject({
      winner: 'att',
      defBefore: { lf: 10 },
      defAfter: {},
      debris: { m: 9000, c: 3000 },
    });
    // Only the battle's Trümmerfeld lies there, whatever the rolls did.
    expect(ctx.debris.all()).toEqual([
      { id: 'd1_2_6', g: 1, s: 2, p: 6, m: 9000, c: 3000 },
    ]);
    // The battle drew, then the two rolls followed.
    expect(n).toBeGreaterThan(2);
    expect(anna(ctx).moonbreak).toMatchObject({ chance: 40, loss: 30 });
  });

  it('writes the rolls into the audit log', () => {
    const { ctx, f, at } = setup();
    ctx.rng = draws(0.39, 0.3);
    onArrive(ctx, f, at);
    expect(
      ctx.db
        .prepare(
          "SELECT category, actor, target, detail FROM audit_events WHERE action = 'moonbreak'",
        )
        .all(),
    ).toEqual([
      {
        category: 'system',
        actor: 'u_Anna',
        target: 'u_Bert',
        detail: JSON.stringify({
          fleet: 'f1',
          moon: 'm1_2_6',
          chance: 40,
          broken: true,
          loss: 30,
          lost: false,
        }),
      },
    ]);
  });

  it('pushes the battle reports with the kinds of every battle report and drops the pushes of the moon queues', () => {
    const { ctx, f, at } = setup();
    subscribePush(ctx, 'u_Anna');
    subscribePush(ctx, 'u_Bert');
    queuePush(ctx, 'u_Bert', {
      kind: 'buildings',
      topic: 'buildings',
      key: 'm1_2_6:1',
      due: 2e9,
    });
    queuePush(ctx, 'u_Bert', {
      kind: 'shipyard',
      topic: 'shipyard',
      key: 'm1_2_6:5',
      due: 2e9,
    });
    queuePush(ctx, 'u_Bert', {
      kind: 'buildings',
      topic: 'buildings',
      key: 'p1_2_6:1',
      due: 2e9,
    });
    ctx.rng = draws(0, 0.9);
    onArrive(ctx, f, at);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Bert', kind: 'buildings', topic: 'buildings' },
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
      { user: 'u_Bert', kind: 'messages', topic: 'attacked' },
    ]);
  });
});

describe('moonbreak: the fleets of a broken moon', () => {
  function world() {
    const { ctx, f, at } = setup();
    addUser(ctx, 'Carl');
    addPlanet(ctx, 'u_Carl', { g: 1, s: 3, p: 4 });
    const other = (id: string, over: Partial<Fleet>) =>
      fleetTo(ctx, {
        id,
        owner: 'u_Carl',
        from: 'p1_3_4',
        fromC: { g: 1, s: 3, p: 4 },
        mission: 'transport',
        ships: { sc: 1 },
        cargo: { m: 10, c: 0, d: 0 },
        arr: ctx.now() + 100,
        ret: ctx.now() + 200,
        ...over,
      });
    // Carl's transport flies to the moon, his attack comes back from it.
    other('t1', {});
    other('t2', { mission: 'attack', state: 'back' });
    // A second Mondbruch of Anna is still on its way.
    fleetTo(ctx, { id: 'f2', arr: ctx.now() + 100, ret: ctx.now() + 200 });
    // Bert's fleets from the moon: one out, one on its way home.
    const fromMoon = {
      owner: 'u_Bert',
      from: 'm1_2_6',
      fromC: AT,
      to: 'p1_1_5',
      toC: { g: 1, s: 1, p: 5 },
      mission: 'transport' as const,
      ships: { sc: 2 },
      arr: ctx.now() + 100,
      ret: ctx.now() + 200,
    };
    fleetTo(ctx, { ...fromMoon, id: 'b1' });
    fleetTo(ctx, { ...fromMoon, id: 'b2', state: 'back' });
    ctx.rng = draws(0, 0.9);
    onArrive(ctx, f, at);
    return ctx;
  }

  it('lands the fleets flying to it at its planet and brings its own fleets home there', () => {
    const ctx = world();
    const where = (id: string) => {
      const x = ctx.fleets.get(id)!;
      return [x.from, x.to, x.state];
    };
    expect(where('f1')).toEqual(['p1_1_5', 'm1_2_6', 'back']);
    expect(where('t1')).toEqual(['p1_3_4', 'p1_2_6', 'out']);
    expect(where('t2')).toEqual(['p1_3_4', 'm1_2_6', 'back']);
    expect(where('f2')).toEqual(['p1_1_5', 'p1_2_6', 'out']);
    expect(where('b1')).toEqual(['p1_2_6', 'p1_1_5', 'out']);
    expect(where('b2')).toEqual(['p1_2_6', 'p1_1_5', 'back']);
  });

  it('turns a Mondbruch back whose moon has become its planet, with „Flotte kehrt um“', () => {
    const ctx = world();
    ctx.clock.t += 100;
    arrive(ctx, ctx.fleets.get('f2')!);
    expect(ctx.fleets.get('f2')!.state).toBe('back');
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      type: 'info',
      title: 'Flotte kehrt um',
      text: 'An [1:2:6] wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.',
    });
    // The planet is not touched.
    expect(ctx.planets.get('p1_2_6')!.res).toEqual({
      m: 9000,
      c: 6000,
      d: 3000,
    });
  });

  it('a transport to the broken moon delivers at its planet', () => {
    const ctx = world();
    ctx.clock.t += 100;
    arrive(ctx, ctx.fleets.get('t1')!);
    expect(ctx.planets.get('p1_2_6')!.res.m).toBeGreaterThanOrEqual(9010);
    expect(ctx.fleets.get('t1')!.state).toBe('back');
  });
});

describe('moonbreak: the fleets that hold at the moon (#55, owner, 2026-11-19)', () => {
  /** Carl, an ally of Bert, has a fleet that holds at Bert's moon; it ends in an hour. */
  function guard(
    ctx: ReturnType<typeof testCtx>,
    ships: Levels,
    over: Partial<Fleet> = {},
  ): Fleet {
    if (!ctx.players.get('u_Carl')) {
      addUser(ctx, 'Carl');
      addPlanet(ctx, 'u_Carl', { g: 1, s: 3, p: 4 });
    }
    return fleetTo(ctx, {
      id: 'h1',
      owner: 'u_Carl',
      from: 'p1_3_4',
      fromC: { g: 1, s: 3, p: 4 },
      mission: 'hold',
      ships,
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 1000,
      arr: ctx.now() - 500,
      ret: ctx.now() + 3_600_000,
      state: 'hold',
      fuel: 1,
      hold: 3_600_000,
      ...over,
    });
  }

  it('lets the fleet that holds defend the moon with its owner: it is a party of its own, its losses and its debris count, both owners get the report', () => {
    // Seven Weltenbrecher break a moon of 3,600 km for certain.
    const { ctx, f, at } = setup({ dstar: 7 });
    guard(ctx, { lf: 2 });
    ctx.rng = seeded(95);
    onArrive(ctx, f, at);
    expect(anna(ctx)).toMatchObject({
      winner: 'att',
      participants: ['u_Anna', 'u_Bert', 'u_Carl'],
      held: [{ name: 'Carl', before: { lf: 2 }, after: {} }],
      // 30 % of the two Lichte Jäger (2 × 3,000 / 1,000).
      debris: { m: 1800, c: 600 },
      moonbreak: { chance: 100, broken: true },
    });
    expect(ctx.reports.ofPlayer('u_Carl')).toMatchObject([
      {
        type: 'battle',
        title: 'Feindkontakt! Mond (Mond) [1:2:6] wird von Anna angegriffen',
        held: [{ name: 'Carl', before: { lf: 2 }, after: {} }],
        moonLost: true,
      },
    ]);
    expect(bert(ctx)).toMatchObject({
      title: 'Feindkontakt! Mond (Mond) [1:2:6] wird von Anna angegriffen',
    });
    expect(ctx.debris.all()).toEqual([
      { id: 'd1_2_6', g: 1, s: 2, p: 6, m: 1800, c: 600 },
    ]);
    // The attacker won: the fleet that held is destroyed with the moon.
    expect(ctx.fleets.get('h1')).toBeNull();
  });

  it('hands the cargo of the destroyed fleet that holds to the moon before the loot, as in a Sturmangriff (#467)', () => {
    const { ctx, f, at } = setup({ dstar: 7, lc: 20 });
    guard(ctx, { lf: 2 }, { cargo: { m: 1000, c: 0, d: 0 } });
    ctx.rng = seeded(95);
    onArrive(ctx, f, at);
    // Half of the moon's 900 / 600 / 300 with the 1,000 Adamant handed over.
    expect(anna(ctx)).toMatchObject({
      loot: { m: 950, c: 300, d: 150 },
    });
    expect(ctx.reports.ofPlayer('u_Carl')[0]).toMatchObject({
      held: [{ name: 'Carl', handed: { m: 1000, c: 0, d: 0 } }],
    });
  });

  it('keeps a moon whose fleet that holds wins: nothing rolls, the fleet holds on with its survivors', () => {
    const { ctx, f, at } = setup({ lf: 1 });
    const h = guard(ctx, { bs: 5 });
    onArrive(ctx, f, at);
    expect(anna(ctx)).toMatchObject({
      winner: 'def',
      held: [{ name: 'Carl', before: { bs: 5 }, after: { bs: 5 } }],
    });
    expect(anna(ctx)).not.toHaveProperty('moonbreak');
    expect(ctx.planets.get('m1_2_6')).not.toBeNull();
    expect(ctx.fleets.get('h1')).toEqual(h);
    expect(ctx.fleets.get('f1')).toBeNull();
  });

  it('fights as before without a fleet that holds, and leaves a fleet of the attacker himself out', () => {
    const { ctx, f, at } = setup({ dstar: 7 });
    guard(ctx, { bs: 1 }, { id: 'mine', owner: 'u_Anna', from: 'p1_1_5' });
    ctx.rng = seeded(95);
    onArrive(ctx, f, at);
    const battle = ctx.reports
      .ofPlayer('u_Anna')
      .find((r) => r.type === 'battle')!;
    expect(battle).toMatchObject({ winner: 'att', defBefore: {} });
    expect(battle).not.toHaveProperty('held');
    expect(battle.participants).toEqual(['u_Anna', 'u_Bert']);
    expect(ctx.debris.all()).toEqual([]);
  });

  it('moves the fleet that holds at the moon to its planet when the moon breaks, with the same end time, and it holds on there', () => {
    // The fleet of the attacker himself stays out of the battle and survives.
    const { ctx, f, at } = setup({ dstar: 7 });
    const h = guard(
      ctx,
      { bs: 1 },
      { id: 'mine', owner: 'u_Anna', from: 'p1_1_5' },
    );
    ctx.rng = seeded(95);
    onArrive(ctx, f, at);
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    expect(ctx.fleets.get('mine')).toEqual({ ...h, to: 'p1_2_6' });
    expect(heldAt(ctx, 'p1_2_6').map((x) => x.id)).toEqual(['mine']);
    expect(heldAt(ctx, 'm1_2_6')).toEqual([]);
    // Its owner, the attacker, is told once that it holds at the planet now
    // (owner, 2026-11-19) [V]; the owner of the moon gets his battle report only.
    expect(
      ctx.reports.ofPlayer('u_Anna').filter((r) => r.type === 'info'),
    ).toMatchObject([
      {
        time: f.arr,
        title: 'Wache wechselt zum Planeten [1:2:6]',
        text: 'Der Mond [1:2:6] wurde zerstört; deine Wache hält jetzt am Planeten.',
      },
    ]);
    expect(ctx.reports.ofPlayer('u_Bert').map((r) => r.type)).toEqual([
      'battle',
    ]);
  });
});

describe('moonbreak: a fleet that holds at a moon that breaks (#55, owner, 2026-11-19)', () => {
  /** A moon with a fleet of Carl that holds there, and one that holds at the planet. */
  function world() {
    const { ctx, at } = setup();
    // No Mondbruch is on its way: the moon is broken by hand.
    ctx.fleets.delete('f1');
    addUser(ctx, 'Carl');
    addUser(ctx, 'Dora');
    addPlanet(ctx, 'u_Carl', { g: 1, s: 3, p: 4 });
    const holds = (id: string, owner: string, to: string): Fleet => {
      const x: Fleet = {
        id,
        owner,
        from: 'p1_3_4',
        fromC: { g: 1, s: 3, p: 4 },
        to,
        toC: AT,
        mission: 'hold',
        ships: { bs: 2 },
        cargo: { m: 5, c: 0, d: 0 },
        dep: ctx.now() - 1000,
        arr: ctx.now() - 500,
        ret: ctx.now() + 3_600_000 + 500,
        state: 'hold',
        recalled: false,
        fuel: 1,
        hold: 3_600_000,
      };
      ctx.fleets.save(x);
      return x;
    };
    return { ctx, at, holds };
  }

  it('moves it to the planet, keeps its end time and ships, and leaves a fleet that holds at the planet as it is', () => {
    const { ctx, at, holds } = world();
    const atMoon = holds('h1', 'u_Carl', 'm1_2_6');
    const atPlanet = holds('h2', 'u_Carl', 'p1_2_6');
    destroyMoon(ctx, at.t);
    expect(ctx.fleets.get('h1')).toEqual({ ...atMoon, to: 'p1_2_6' });
    expect(ctx.fleets.get('h2')).toEqual(atPlanet);
    expect(dueAt(ctx.fleets.get('h1')!)).toBe(dueAt(atMoon));
    expect(
      heldAt(ctx, 'p1_2_6')
        .map((x) => x.id)
        .sort(),
    ).toEqual(['h1', 'h2']);
    expect(heldAt(ctx, 'm1_2_6')).toEqual([]);
  });

  it('lets it hold on until its time ends, then it flies home as planned', () => {
    const { ctx, at, holds } = world();
    const h = holds('h1', 'u_Carl', 'm1_2_6');
    destroyMoon(ctx, at.t);
    ctx.clock.t = h.arr + 3_600_000 - 1;
    expect(tick(ctx)).toBe(0);
    expect(ctx.fleets.get('h1')).toMatchObject({ state: 'hold' });
    ctx.clock.t = h.arr + 3_600_000;
    tick(ctx);
    expect(ctx.fleets.get('h1')).toMatchObject({ state: 'back', ret: h.ret });
    ctx.clock.t = h.ret;
    tick(ctx);
    expect(ctx.fleets.get('h1')).toBeNull();
    expect(ctx.planets.get('p1_3_4')!.ships.bs).toBe(2);
  });

  it('defends the planet afterwards, in the next Sturmangriff', () => {
    const { ctx, at, holds } = world();
    holds('h1', 'u_Carl', 'm1_2_6');
    destroyMoon(ctx, at.t);
    const raider: Fleet = {
      ...fleetTo(ctx, { id: 'att', mission: 'attack', ships: { lf: 1 } }),
      to: 'p1_2_6',
      state: 'out',
    };
    ctx.fleets.save(raider);
    arrive(ctx, raider);
    // Newest first: the battle, before it the notice of the move.
    expect(ctx.reports.ofPlayer('u_Carl')).toMatchObject([
      {
        type: 'battle',
        held: [{ name: 'Carl', before: { bs: 2 } }],
      },
      { type: 'info', title: 'Wache wechselt zum Planeten [1:2:6]' },
    ]);
    expect(ctx.fleets.get('att')).toBeNull();
  });

  it('tells the owner of each fleet that holds at the moon, once per fleet, in the style of an info report (owner, 2026-11-19) [V]', () => {
    const { ctx, at, holds } = world();
    holds('h1', 'u_Carl', 'm1_2_6');
    holds('h2', 'u_Carl', 'm1_2_6');
    holds('h3', 'u_Dora', 'm1_2_6');
    // Not guards of the moon: a fleet at the planet, one on its way home from
    // it, and a fleet of the attacker that flies to it.
    holds('at', 'u_Dora', 'p1_2_6');
    const home = holds('home', 'u_Dora', 'm1_2_6');
    ctx.fleets.save({ ...home, state: 'back' });
    fleetTo(ctx, { id: 'f9', owner: 'u_Anna', mission: 'transport' });
    ctx.clock.t += 7;
    destroyMoon(ctx, at.t);
    const notice = {
      time: ctx.now(),
      type: 'info',
      title: 'Wache wechselt zum Planeten [1:2:6]',
      text: 'Der Mond [1:2:6] wurde zerstört; deine Wache hält jetzt am Planeten.',
    };
    expect(ctx.reports.ofPlayer('u_Carl')).toMatchObject([notice, notice]);
    expect(ctx.reports.ofPlayer('u_Dora')).toMatchObject([notice]);
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.reports.ofPlayer('u_Bert')).toEqual([]);
  });

  it('pushes the notice to the owner of the fleet as „fleet“', () => {
    const { ctx, at, holds } = world();
    holds('h1', 'u_Carl', 'm1_2_6');
    subscribePush(ctx, 'u_Carl');
    destroyMoon(ctx, at.t);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Carl', kind: 'messages', topic: 'fleet' },
    ]);
  });

  it('moves it even where the planet is full: 15 fleets already hold there (open point)', () => {
    const { ctx, at, holds } = world();
    for (let i = 0; i < 15; i++) holds(`p${i}`, 'u_Carl', 'p1_2_6');
    holds('h1', 'u_Dora', 'm1_2_6');
    destroyMoon(ctx, at.t);
    expect(ctx.fleets.get('h1')).toMatchObject({
      to: 'p1_2_6',
      state: 'hold',
    });
    expect(holdersAt(ctx, 'p1_2_6')).toHaveLength(16);
  });

  it('still reroutes the fleets flying to the moon as before and does not touch a fleet that is on its way home from it', () => {
    const { ctx, at, holds } = world();
    holds('h1', 'u_Carl', 'm1_2_6');
    holds('back', 'u_Carl', 'm1_2_6');
    ctx.fleets.save({ ...ctx.fleets.get('back')!, state: 'back' });
    destroyMoon(ctx, at.t);
    expect(ctx.fleets.get('h1')!.to).toBe('p1_2_6');
    expect(ctx.fleets.get('back')!.to).toBe('m1_2_6');
  });
});
