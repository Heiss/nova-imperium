// A Sturmangriff fights the ships and the defense of the target: the winner
// takes loot, the destroyed ships leave a Trümmerfeld (#45), at a planet
// without a moon the whole field may form one (#53), 70 % of the destroyed
// defense is rebuilt, both sides get a battle report; a fleet without
// survivors is gone. The battle and its consequences are shared with the
// detected Auspex-Erkundung (#175) in src/server/game/fight.ts.
import { capacity, countUnits } from '../../../core/flight.ts';
import { placeName } from '../../../core/moon.ts';
import type { Fleet, Resources } from '../../../core/types.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import {
  WON,
  battleReport,
  fight,
  recordBattle,
} from '../../../server/game/fight.ts';
import { type Arrival, turnBack } from '../../../server/game/missions.ts';

/** The winner takes up to half of each resource, as much as the holds carry. */
export function plunder(stock: Resources, free: number): Resources {
  let cap = free;
  const loot = { m: 0, c: 0, d: 0 };
  const half = { m: stock.m / 2, c: stock.c / 2, d: stock.d / 2 };
  const take = (k: keyof Resources, limit: number): void => {
    const v = Math.max(0, Math.floor(Math.min(half[k] - loot[k], limit)));
    loot[k] += v;
    cap -= v;
  };
  take('m', cap / 3);
  take('c', cap / 2);
  take('d', cap);
  take('m', cap / 2);
  take('c', cap);
  take('m', cap);
  return loot;
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att } = at;
  const x = fight(ctx, f, at);
  const { res } = x;
  const free = capacity(res.att) - (f.cargo.m + f.cargo.c + f.cargo.d);
  const loot =
    res.winner === 'att' ? plunder(t.res, free) : { m: 0, c: 0, d: 0 };
  t.res.m -= loot.m;
  t.res.c -= loot.c;
  t.res.d -= loot.d;
  ctx.planets.save(t);
  recordBattle(ctx, f, t, x);
  const report = battleReport(f, at, x, loot);
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[res.winner]}`;
  addReport(ctx, f.owner, { ...report, title: won }, { topic: 'fleet' });
  const hit = `Feindkontakt! ${placeName(t)} ${coords(f.toC)} wird von ${att.name} angegriffen`;
  addReport(ctx, t.owner, { ...report, title: hit }, { topic: 'attacked' });
  if (!countUnits(res.att)) return ctx.fleets.delete(f.id);
  const cargo = {
    m: f.cargo.m + loot.m,
    c: f.cargo.c + loot.c,
    d: f.cargo.d + loot.d,
  };
  turnBack(ctx, f, { ships: res.att, cargo });
}
