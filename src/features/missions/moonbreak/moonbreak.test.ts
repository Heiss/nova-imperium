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
import { arrive } from '../../../server/game/arrival.ts';
import { cutLoot } from '../../../server/game/fight.ts';
import { categoryScores } from '../../../server/game/highscore.ts';
import { addMoon } from '../../../server/game/moons.ts';
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
      order: 70,
      target: 'foreignMoon',
      cargo: true,
      returns: true,
      visible: true,
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

  it('changes the highscore like an attack: the moon leaves the buildings of its owner, the lost Weltenbrecher the fleet of the attacker (#78, #95)', () => {
    const { ctx, f, at } = setup(
      { dstar: 1, lc: 2 },
      { b: { moonbase: 8, phalanx: 3 } },
    );
    const before = categoryScores(ctx);
    const total = pointsMap(ctx);
    expect(before.u_Bert!.buildings).toBeGreaterThan(0);
    expect(before.u_Anna!.fleet).toBe(3);
    // The moon breaks (0.39 < 40 %) and the Weltenbrecher are torn apart (0.2 < 30 %).
    ctx.rng = draws(0.39, 0.2);
    onArrive(ctx, f, at);
    const after = categoryScores(ctx);
    expect(ctx.planets.get('m1_2_6')).toBeNull();
    expect(after.u_Bert!.buildings).toBe(0);
    expect(after.u_Anna!.fleet).toBe(2);
    expect(after.u_Anna!.buildings).toBe(before.u_Anna!.buildings);
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
