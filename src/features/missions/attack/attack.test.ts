// Sturmangriff (#116): no check of its own; a battle at the target with
// loot, rebuilt defense, an audit entry and two reports (seeded random).
import { describe, expect, it } from 'vitest';
import type { Fleet, Levels } from '../../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { onArrive, plunder, rebuild } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

function setup(ships: Levels, def: Levels) {
  const ctx = testCtx(1_000_000, 42);
  addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const t = addPlanet(ctx, 'u_Bert', {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    def,
    res: { m: 9000, c: 6000, d: 3000 },
  });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: t.id,
    toC: { g: 1, s: 2, p: 6 },
    mission: 'attack',
    ships,
    cargo: { m: 0, c: 0, d: 100 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  const att = { name: 'Anna', research: {}, rq: null };
  const defender = { name: 'Bert', research: {}, rq: null };
  return { ctx, f, at: { t, att, def: defender } };
}

describe('attack', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 10,
      target: 'foreign',
      cargo: true,
      returns: true,
      visible: true,
      silent: false,
    });
  });

  it('sends any ships', () => {
    expect(canSend()).toBeUndefined();
  });

  it('rebuilds 70 % of the defense and plunders up to half', () => {
    expect(rebuild(0, () => 0)).toBe(0);
    expect(rebuild(100, () => 1)).toBe(70);
    expect(rebuild(3, () => 0.5)).toBe(3);
    expect(rebuild(3, () => 0.9)).toBe(0);
    expect(plunder({ m: 900, c: 600, d: 300 }, 1e9)).toEqual({
      m: 450,
      c: 300,
      d: 150,
    });
    expect(plunder({ m: 900, c: 600, d: 300 }, 300)).toEqual({
      m: 100,
      c: 100,
      d: 100,
    });
  });

  it('wins, takes loot and flies back with it', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    onArrive(ctx, f, at);
    const back = ctx.fleets.get('f1')!;
    expect(back.state).toBe('back');
    expect(back.cargo).toEqual({ m: 4500, c: 3000, d: 1600 });
    expect(ctx.planets.get('p1_2_6')!.res).toEqual({
      m: 4500,
      c: 3000,
      d: 1500,
    });
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      type: 'battle',
      time: f.arr,
      title: 'Kampfbericht [1:2:6] – gewonnen',
      winner: 'att',
      loot: { m: 4500, c: 3000, d: 1500 },
    });
    expect(ctx.reports.ofPlayer('u_Bert')[0]!.title).toBe(
      'Feindkontakt! Beta [1:2:6] wird von Anna angegriffen',
    );
    const audit = ctx.db
      .prepare(
        "SELECT actor, target, detail FROM audit_events WHERE action = 'battle'",
      )
      .all();
    expect(audit).toEqual([
      {
        actor: 'u_Anna',
        target: 'u_Bert',
        detail: JSON.stringify({
          fleet: 'f1',
          planet: 'p1_2_6',
          winner: 'att',
          scheduled: f.arr,
        }),
      },
    ]);
  });

  it('a fleet without survivors is gone and takes nothing', () => {
    const { ctx, f, at } = setup({ lc: 1 }, { pt: 50 });
    onArrive(ctx, f, at);
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      title: 'Kampfbericht [1:2:6] – verloren',
      loot: { m: 0, c: 0, d: 0 },
    });
    expect(ctx.planets.get('p1_2_6')!.def.pt).toBe(50);
  });
});
