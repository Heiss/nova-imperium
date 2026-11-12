import { isDatabaseBusy } from '../db/database.ts';
import { queuePush } from '../push-store.ts';
// What happens when a fleet arrives or comes home: transport, deploy,
// espionage, battle with loot and rebuilt defense.
import { record } from '../audit.ts';
import { battle } from '../../shared/battle.ts';
import { DEF, SHIPS } from '../../shared/catalog.ts';
import { capacity, countUnits } from '../../shared/flight.ts';
import { settle, settleR } from '../../shared/settle.ts';
import type { Fleet, Levels, Planet, Resources } from '../../shared/types.ts';
import type { User } from '../db/store.ts';
import {
  type Ctx,
  addReport,
  coords,
  fmt,
  resLine,
  universe,
} from './context.ts';

import { createPlanet } from './planets.ts';

const UNKNOWN = { name: 'Unbekannt', research: {}, rq: null };
type Player = Pick<User, 'name' | 'research' | 'rq'>;

const player = (ctx: Ctx, id: string): Player => ctx.store.user(id) ?? UNKNOWN;
const techAt = (p: Player, t: number): Levels => settleR(p, t).research;

function turnBack(ctx: Ctx, f: Fleet, change: Partial<Fleet> = {}): void {
  Object.assign(f, change, { state: 'back' });
  ctx.store.saveFleet(f);
}

/** Puts ships and cargo onto a planet, also above its storage limit. */
function land(p: Planet, ships: Levels, cargo: Resources): void {
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) + n;
  p.res.m += cargo.m;
  p.res.c += cargo.c;
  p.res.d += cargo.d;
}

function transport(ctx: Ctx, f: Fleet, t: Planet, att: Player): void {
  land(t, {}, f.cargo);
  ctx.store.savePlanet(t);
  const text = `Eine Flotte von ${att.name} erreicht ${t.name} ${coords(f.toC)} und liefert ${resLine(f.cargo)}.`;
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: `Transport erreicht ${coords(f.toC)}`,
    participants: [f.owner, t.owner],
    text,
  });
  if (t.owner !== f.owner)
    addReport(ctx, t.owner, {
      time: f.arr,
      type: 'info',
      title: `Lieferung von ${att.name}`,
      participants: [f.owner, t.owner],
      text,
    });
  turnBack(ctx, f, { cargo: { m: 0, c: 0, d: 0 } });
}

/** How much a spy report shows: more probes and better technology show more. */
export function spyScore(probes: number, diff: number): number {
  return probes + Math.sign(diff) * diff * diff;
}

export function counterChance(defShips: number, diff: number): number {
  return defShips
    ? Math.min(100, Math.round(2 * Math.sqrt(defShips) * Math.pow(2, -diff)))
    : 0;
}

const SPY_LEVELS: [number, 'ships' | 'def' | 'b' | 'r'][] = [
  [2, 'ships'],
  [3, 'def'],
  [5, 'b'],
  [7, 'r'],
];

function spy(
  ctx: Ctx,
  f: Fleet,
  t: Planet,
  att: Player,
  def: Player & { id?: string },
): void {
  const attR = techAt(att, f.arr);
  const defR = techAt(def, f.arr);
  const diff = (attR.spy ?? 0) - (defR.spy ?? 0);
  const score = spyScore(f.ships.probe ?? 0, diff);
  const chance = counterChance(countUnits(t.ships), diff);
  const lost = ctx.rng() * 100 < chance;
  const details = { ships: t.ships, def: t.def, b: t.b, r: defR };
  const shown = Object.fromEntries(
    SPY_LEVELS.filter(([min]) => score >= min).map(([, k]) => [k, details[k]]),
  );
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'spy',
    title: `Spionagebericht von ${t.name} ${coords(f.toC)}`,
    participants: [f.owner, t.owner],
    name: t.name,
    defName: def.name,
    coords: f.toC,
    res: {
      m: Math.floor(t.res.m),
      c: Math.floor(t.res.c),
      d: Math.floor(t.res.d),
    },
    counter: chance,
    lost,
    ...shown,
  });
  const text = `Eine fremde Flotte von ${att.name} ${coords(f.fromC)} wurde in der Nähe deines Planeten ${t.name} ${coords(f.toC)} gesichtet. Chance auf Spionageabwehr: ${chance} %.${lost ? ' Die Sonden wurden abgeschossen!' : ''}`;
  addReport(ctx, t.owner, {
    time: f.arr,
    type: 'info',
    title: 'Spionageaktivität',
    participants: [f.owner, t.owner],
    text,
  });
  if (lost) ctx.store.deleteFleet(f.id);
  else turnBack(ctx, f);
}

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
    attTech: tech(x.attR),
    defTech: tech(x.defR),
  };
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[x.res.winner]}`;
  addReport(ctx, f.owner, { ...report, title: won });
  const hit = `Angriff auf ${t.name} ${coords(f.toC)} durch ${x.att.name}`;
  addReport(ctx, t.owner, { ...report, title: hit });
}

function attack(ctx: Ctx, f: Fleet, t: Planet, att: Player, def: Player): void {
  const attR = techAt(att, f.arr);
  const defR = techAt(def, f.arr);
  const defBefore = { ...t.ships, ...t.def };
  const res = battle(
    { units: f.ships, tech: attR },
    { units: defBefore, tech: defR },
    ctx.rng,
  );
  const after = afterBattle(ctx, t, res.def);
  const free = capacity(res.att) - (f.cargo.m + f.cargo.c + f.cargo.d);
  const loot =
    res.winner === 'att' ? plunder(t.res, free) : { m: 0, c: 0, d: 0 };
  t.res.m -= loot.m;
  t.res.c -= loot.c;
  t.res.d -= loot.d;
  t.ships = after.ships;
  t.def = after.def;
  ctx.store.savePlanet(t);
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
  });
  if (!countUnits(res.att)) return ctx.store.deleteFleet(f.id);
  const cargo = {
    m: f.cargo.m + loot.m,
    c: f.cargo.c + loot.c,
    d: f.cargo.d + loot.d,
  };
  turnBack(ctx, f, { ships: res.att, cargo });
}

function unsuitableTarget(ctx: Ctx, f: Fleet): void {
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: 'Flotte kehrt um',
    text: `An ${coords(f.toC)} wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.`,
  });
  turnBack(ctx, f);
}

function colonize(ctx: Ctx, f: Fleet, occupied: Planet | null): void {
  const u = universe(ctx);
  const { g, s, p } = f.toC;
  if (occupied || g > u.galaxies || s > u.systems || p > u.positions)
    return unsuitableTarget(ctx, f);
  createPlanet(ctx, f.owner, 'Kolonie', f.toC, f.arr, f.cargo);
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: `Kolonie gegründet ${coords(f.toC)}`,
    text: 'Dein Kolonialschiff hat eine neue Kolonie gegründet.',
  });
  const ships = { ...f.ships };
  if (ships.colony === 1) delete ships.colony;
  else ships.colony = ships.colony! - 1;
  if (!countUnits(ships)) return ctx.store.deleteFleet(f.id);
  turnBack(ctx, f, { ships, cargo: { m: 0, c: 0, d: 0 } });
}

/**
 * A deploy stays at the target with its ships and cargo, plus half of the
 * fuel it burnt, rounded down; the fleet ends there (#129).
 */
function deploy(ctx: Ctx, f: Fleet, t: Planet): void {
  const rest = Math.floor(f.fuel / 2);
  const load = { ...f.cargo, d: f.cargo.d + rest };
  land(t, f.ships, load);
  ctx.store.savePlanet(t);
  addReport(ctx, f.owner, {
    time: f.arr,
    type: 'info',
    title: `Verlegung erreicht ${coords(f.toC)}`,
    text: `Deine Flotte bleibt auf ${t.name} ${coords(f.toC)} und liefert ${resLine(load)}, davon ${fmt(rest)} übriger Treibstoff.`,
  });
  ctx.store.deleteFleet(f.id);
}

/** A deploy needs an own planet, a transport any, the others a foreign one. */
function fits(f: Fleet, t: Planet | null): t is Planet {
  if (!t) return false;
  if (f.mission === 'transport') return true;
  return (t.owner === f.owner) === (f.mission === 'deploy');
}

export function arrive(ctx: Ctx, f: Fleet): void {
  const t0 = ctx.store.planet(f.to);
  if (f.mission === 'colonize') return colonize(ctx, f, t0);
  if (!fits(f, t0)) return unsuitableTarget(ctx, f);
  const att = player(ctx, f.owner);
  const def = player(ctx, t0.owner);
  const t = settle(t0, f.arr, universe(ctx), def);
  if (f.mission === 'deploy') return deploy(ctx, f, t);
  if (f.mission === 'transport') return transport(ctx, f, t, att);
  if (f.mission === 'spy') return spy(ctx, f, t, att, def);
  attack(ctx, f, t, att, def);
}

export function comeHome(ctx: Ctx, f: Fleet): void {
  const o0 = ctx.store.planet(f.from);
  if (o0 && o0.owner === f.owner) {
    const o = settle(o0, f.ret, universe(ctx), player(ctx, f.owner));
    land(o, f.ships, f.cargo);
    ctx.store.savePlanet(o);
    const sum = f.cargo.m + f.cargo.c + f.cargo.d;
    if (f.mission !== 'spy' || f.recalled)
      addReport(
        ctx,
        f.owner,
        {
          time: f.ret,
          type: 'info',
          title: `Rückkehr zu ${o.name} ${coords(f.fromC)}`,
          text: `Deine Flotte ist zurück${sum ? ' und bringt ' + resLine(f.cargo) + ' mit' : ''}.`,
        },
        'fleet',
      );
    else queuePush(ctx, f.owner, 'fleet', f.id, ctx.now());
  }
  ctx.store.deleteFleet(f.id);
}

/** Processes all due fleets in time order. A broken fleet is logged and removed. */
export function tick(
  ctx: Ctx,
  log: (msg: string, e: unknown) => void = console.error,
): number {
  const now = ctx.now();
  const due = ctx.store.dueFleets(now);
  for (const f of due) {
    try {
      ctx.store.tx(() => {
        const live = ctx.store.fleet(f.id);
        if (!live || (live.state === 'out' ? live.arr : live.ret) > now) return;
        if (live.state === 'out') arrive(ctx, live);
        else comeHome(ctx, live);
      });
    } catch (e) {
      // Leave the fleet in place for the next tick when another writer holds the lock.
      if (isDatabaseBusy(e)) break;
      log(`Fleet ${f.id} failed and was removed`, e);
      ctx.store.deleteFleet(f.id);
    }
  }
  return due.length;
}
