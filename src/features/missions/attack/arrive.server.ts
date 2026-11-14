// A Sturmangriff fights the ships and the defense of the target: the winner
// takes loot, the destroyed ships leave a Trümmerfeld (#45), 70 % of the
// destroyed defense is rebuilt, both sides get a battle report; a fleet
// without survivors is gone.
import { battle } from '../../../core/battle.ts';
import { DEF, SHIPS } from '../../../core/catalog.ts';
import { type Debris, debrisOf, isEmpty } from '../../../core/debris.ts';
import { capacity, countUnits } from '../../../core/flight.ts';
import type { Fleet, Levels, Planet, Resources } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import {
  type Arrival,
  type Player,
  researchAt,
  turnBack,
} from '../../../server/game/missions.ts';

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
export function rebuild(lost: number, rng: () => number): number {
  if (lost <= 0) return 0;
  if (lost >= 50) return Math.round(lost * 0.7);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < 0.7) n++;
  return n;
}

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

function afterBattle(
  ctx: Ctx,
  t: Planet,
  after: Levels,
): { rebuilt: Levels; def: Levels; ships: Levels } {
  const rebuilt: Levels = {};
  const def: Levels = {};
  const ships: Levels = {};
  for (const k of Object.keys(DEF)) {
    const left = after[k] ?? 0;
    const rb = rebuild((t.def[k] ?? 0) - left, ctx.rng);
    if (rb) rebuilt[k] = rb;
    if (left + rb) def[k] = left + rb;
  }
  for (const k of Object.keys(SHIPS)) if (after[k]) ships[k] = after[k];
  return { rebuilt, def, ships };
}

const tech = (r: Levels): Levels => ({
  weapons: r.weapons ?? 0,
  shield: r.shield ?? 0,
  armor: r.armor ?? 0,
});

const WON = {
  att: 'gewonnen',
  def: 'verloren',
  draw: 'unentschieden',
} as const;

interface Fight {
  f: Fleet;
  t: Planet;
  att: Player;
  def: Player;
  attR: Levels;
  defR: Levels;
  defBefore: Levels;
  res: ReturnType<typeof battle>;
  rebuilt: Levels;
  loot: Resources;
  debris: Debris;
}

function battleReports(ctx: Ctx, x: Fight): void {
  const { f, t } = x;
  const report = {
    time: f.arr,
    type: 'battle' as const,
    participants: [f.owner, t.owner],
    name: t.name,
    coords: f.toC,
    attName: x.att.name,
    defName: x.def.name,
    rounds: x.res.rounds,
    winner: x.res.winner,
    attBefore: f.ships,
    attAfter: x.res.att,
    defBefore: x.defBefore,
    defAfter: x.res.def,
    rebuilt: x.rebuilt,
    loot: x.loot,
    debris: x.debris,
    attTech: tech(x.attR),
    defTech: tech(x.defR),
  };
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[x.res.winner]}`;
  addReport(ctx, f.owner, { ...report, title: won }, { topic: 'fleet' });
  const hit = `Feindkontakt! ${t.name} ${coords(f.toC)} wird von ${x.att.name} angegriffen`;
  addReport(ctx, t.owner, { ...report, title: hit }, { topic: 'attacked' });
}

/** The debris step: 30 % of the ships both sides lost lie at the position (#45). */
function leaveDebris(
  ctx: Ctx,
  f: Fleet,
  defBefore: Levels,
  res: ReturnType<typeof battle>,
): Debris {
  const debris = debrisOf([
    { before: f.ships, after: res.att },
    { before: defBefore, after: res.def },
  ]);
  if (!isEmpty(debris)) ctx.debris.add(f.toC, debris);
  return debris;
}

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const defBefore = { ...t.ships, ...t.def };
  const res = battle(
    { units: f.ships, tech: attR },
    { units: defBefore, tech: defR },
    ctx.rng,
  );
  const debris = leaveDebris(ctx, f, defBefore, res);
  const after = afterBattle(ctx, t, res.def);
  const free = capacity(res.att) - (f.cargo.m + f.cargo.c + f.cargo.d);
  const loot =
    res.winner === 'att' ? plunder(t.res, free) : { m: 0, c: 0, d: 0 };
  t.res.m -= loot.m;
  t.res.c -= loot.c;
  t.res.d -= loot.d;
  t.ships = after.ships;
  t.def = after.def;
  ctx.planets.save(t);
  record(ctx, {
    category: 'system',
    action: 'battle',
    actor: f.owner,
    target: t.owner,
    detail: { fleet: f.id, planet: t.id, winner: res.winner, scheduled: f.arr },
  });
  battleReports(ctx, {
    f,
    t,
    att,
    def,
    attR,
    defR,
    defBefore,
    res,
    rebuilt: after.rebuilt,
    loot,
    debris,
  });
  if (!countUnits(res.att)) return ctx.fleets.delete(f.id);
  const cargo = {
    m: f.cargo.m + loot.m,
    c: f.cargo.c + loot.c,
    d: f.cargo.d + loot.d,
  };
  turnBack(ctx, f, { ships: res.att, cargo });
}
