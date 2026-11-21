// The steps that Sturmangriff and Mondbruch share (#95, #175): the loot, the
// raid with its audit entry, the two battle reports and the flight home,
// with exact values.
import { describe, expect, it } from 'vitest';
import type { Fleet, Levels, Resources } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import {
  WON,
  addResources,
  attackReports,
  cutLoot,
  flyHome,
  plunder,
  raid,
  total,
} from './fight.ts';

const R = (m: number, c: number, d: number): Resources => ({ m, c, d });

describe('the loot', () => {
  it('takes up to half of each resource, in the order of the classic loot', () => {
    expect(plunder(R(900, 600, 300), 1e9)).toEqual(R(450, 300, 150));
    // 300 free: a third Adamant (100), half of the rest Psikristall (100),
    // the rest Promethium (100); every resource keeps room for the passes.
    expect(plunder(R(9000, 6000, 3000), 300)).toEqual(R(100, 100, 100));
    // Promethium is short (half of 600 is 300): the second passes give the
    // 700 left to Adamant (350) and Psikristall (350).
    expect(plunder(R(9000, 6000, 600), 3000)).toEqual(R(1350, 1350, 300));
  });

  it('takes nothing without room and never a fraction', () => {
    expect(plunder(R(9000, 9000, 9000), 0)).toEqual(R(0, 0, 0));
    expect(plunder(R(9000, 9000, 9000), -50)).toEqual(R(0, 0, 0));
    expect(plunder(R(3, 3, 3), 1e9)).toEqual(R(1, 1, 1));
    expect(plunder(R(0, 0, 0), 1e9)).toEqual(R(0, 0, 0));
  });

  it('cuts a stock to the room that is free, in the same order, and keeps what fits', () => {
    const stock = R(900, 600, 300);
    expect(cutLoot(stock, 1e9)).toEqual(stock);
    expect(cutLoot(stock, 1800)).toEqual(stock);
    expect(cutLoot(stock, 1799)).toEqual(R(899, 600, 300));
    expect(cutLoot(stock, 300)).toEqual(R(100, 100, 100));
    // A single unit of room is no third of anything: Promethium takes it.
    expect(cutLoot(stock, 1)).toEqual(R(0, 0, 1));
    expect(cutLoot(stock, 0)).toEqual(R(0, 0, 0));
    expect(cutLoot(stock, -50)).toEqual(R(0, 0, 0));
    expect(cutLoot(R(0, 0, 30), 1000)).toEqual(R(0, 0, 30));
    expect(cutLoot(R(0, 40, 0), 25)).toEqual(R(0, 25, 0));
  });

  it('counts and adds stocks', () => {
    expect(total(R(1, 20, 300))).toBe(321);
    expect(total(R(0, 0, 0))).toBe(0);
    expect(addResources(R(1, 2, 3), R(10, 20, 30))).toEqual(R(11, 22, 33));
  });

  it('words the result as the attacker reads it', () => {
    expect(WON).toEqual({
      att: 'gewonnen',
      def: 'verloren',
      draw: 'unentschieden',
    });
  });
});

/** Anna's fleet at Bert's planet Beta [1:2:6] with 9,000 / 6,000 / 3,000. */
function setup(ships: Levels, def: Levels, cargo = R(0, 0, 100)) {
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
    res: R(9000, 6000, 3000),
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
    cargo,
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 1,
  };
  ctx.fleets.save(f);
  const att = { name: 'Anna', research: {}, rq: null };
  const def2 = { name: 'Bert', research: {}, rq: null };
  return { ctx, f, at: { t, att, def: def2 } };
}

describe('the raid', () => {
  it('takes the loot of a won battle, saves the target and writes the audit entry', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    const x = raid(ctx, f, at);
    expect(x.res.winner).toBe('att');
    expect(x.loot).toEqual(R(4500, 3000, 1500));
    expect(ctx.planets.get('p1_2_6')!.res).toEqual(R(4500, 3000, 1500));
    expect(at.t.res).toEqual(R(4500, 3000, 1500));
    expect(
      ctx.db.prepare('SELECT action FROM audit_events').pluck().all(),
    ).toEqual(['battle']);
    // Nothing is reported or moved yet: the mission does that.
    expect(ctx.reports.ofPlayer('u_Anna')).toEqual([]);
    expect(ctx.fleets.get('f1')!.state).toBe('out');
  });

  it('counts what the fleet carries against the holds of the ships that survive', () => {
    // 20 Kathedralschiffe survive and carry nothing themselves; 50 Lastbarken
    // hold 6,500 · ... : one Lastbarke alone holds 25,000 and carries 100.
    const full = setup({ lc: 1 }, {}, R(25_000, 0, 0));
    expect(raid(full.ctx, full.f, full.at).loot).toEqual(R(0, 0, 0));
    const almost = setup({ lc: 1 }, {}, R(24_990, 0, 0));
    // 10 free: a third Adamant (3), half of the rest Psikristall (3), the
    // rest Promethium (4).
    expect(raid(almost.ctx, almost.f, almost.at).loot).toEqual(R(3, 3, 4));
  });

  it('takes nothing from a lost battle and leaves the stock to the defender', () => {
    const { ctx, f, at } = setup({ lc: 1 }, { pt: 50 });
    const x = raid(ctx, f, at);
    expect(x.res.winner).toBe('def');
    expect(x.loot).toEqual(R(0, 0, 0));
    expect(ctx.planets.get('p1_2_6')!.res).toEqual(R(9000, 6000, 3000));
    expect(
      ctx.db.prepare('SELECT detail FROM audit_events').pluck().get(),
    ).toBe(
      JSON.stringify({
        fleet: 'f1',
        planet: 'p1_2_6',
        winner: 'def',
        scheduled: f.arr,
      }),
    );
  });
});

describe('the two battle reports', () => {
  it('give both sides the same figures with their own titles and topics', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    attackReports(ctx, f, at, raid(ctx, f, at));
    const mine = ctx.reports.ofPlayer('u_Anna')[0]!;
    const his = ctx.reports.ofPlayer('u_Bert')[0]!;
    expect(mine.title).toBe('Kampfbericht [1:2:6] – gewonnen');
    expect(his.title).toBe(
      'Feindkontakt! Beta [1:2:6] wird von Anna angegriffen',
    );
    for (const r of [mine, his])
      expect(r).toMatchObject({
        type: 'battle',
        time: f.arr,
        winner: 'att',
        loot: R(4500, 3000, 1500),
        attName: 'Anna',
        defName: 'Bert',
        name: 'Beta',
      });
    expect(mine).not.toHaveProperty('moonbreak');
    expect(his).not.toHaveProperty('moonLost');
  });

  it('adds what the mission says to each side only, and titles win', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    attackReports(ctx, f, at, raid(ctx, f, at), {
      att: { extraAtt: 1, title: 'nein' },
      def: { extraDef: 2 },
    });
    const mine = ctx.reports.ofPlayer('u_Anna')[0]!;
    const his = ctx.reports.ofPlayer('u_Bert')[0]!;
    expect(mine).toMatchObject({
      extraAtt: 1,
      title: 'Kampfbericht [1:2:6] – gewonnen',
    });
    expect(mine).not.toHaveProperty('extraDef');
    expect(his).toMatchObject({ extraDef: 2 });
    expect(his).not.toHaveProperty('extraAtt');
  });

  it('word a lost battle from the attacker’s side', () => {
    const { ctx, f, at } = setup({ lc: 1 }, { pt: 50 });
    attackReports(ctx, f, at, raid(ctx, f, at));
    expect(ctx.reports.ofPlayer('u_Anna')[0]).toMatchObject({
      title: 'Kampfbericht [1:2:6] – verloren',
      loot: R(0, 0, 0),
    });
  });
});

describe('the flight home', () => {
  it('turns the fleet back with the ships left and its cargo plus the loot', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    flyHome(ctx, f, raid(ctx, f, at));
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { bs: 20, lc: 50 },
      cargo: R(4500, 3000, 1600),
    });
  });

  it('takes the ships and the cargo it is given instead', () => {
    const { ctx, f, at } = setup({ bs: 20, lc: 50 }, { rl: 2 });
    flyHome(ctx, f, raid(ctx, f, at), { lc: 3 }, R(7, 8, 9));
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { lc: 3 },
      cargo: R(7, 8, 9),
    });
  });

  it('deletes a fleet without ships and carries nothing home', () => {
    const { ctx, f, at } = setup({ bs: 20 }, { rl: 2 });
    flyHome(ctx, f, raid(ctx, f, at), {}, R(7, 8, 9));
    expect(ctx.fleets.get('f1')).toBeNull();
    const second = setup({ lc: 1 }, { pt: 50 });
    flyHome(second.ctx, second.f, raid(second.ctx, second.f, second.at));
    expect(second.ctx.fleets.get('f1')).toBeNull();
  });
});
