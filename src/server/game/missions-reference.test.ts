// The missions as strategies (#116) send and arrive exactly as before: a
// property test on generated worlds and fleets with the same seeded random
// stream and a fixed clock (owner, 2026-11-14). Each case builds two equal
// databases, runs today's code on one and the reference on the other, and
// compares the answer, every table and the next random number, so the
// random draws are the same too. The reference below is
// src/server/game/arrival.ts (without `tick`, which did not change) and the
// sending part of src/server/game/fleet-actions.ts as they were on main
// before #116, copied unchanged but for the `export` keywords, the
// debris rule of #45 (owner, 2026-11-14), which the reference writes on its
// own (`refDebris`, `refLeaveDebris`) so that it compares the debris rows
// and the report field `debris` bit for bit too, and the push kinds of #192
// (the argument of `addReport` and `queuePush`, the same kinds as today's
// code).
import Database from 'better-sqlite3';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { battle } from '../../core/battle.ts';
import { type Debris, debrisOf, isEmpty } from '../../core/debris.ts';
import { DEF, MISSION, SHIPS, canFly, isShip } from '../../core/catalog.ts';
import {
  capacity,
  countUnits,
  deployFuel,
  distance,
  fleetSlots,
  fleetSpeed,
  flightMs,
  fuelFor,
} from '../../core/flight.ts';
import { placeId } from '../../core/place.ts';
import { settle, settleR } from '../../core/settle.ts';
import type {
  Coords,
  Fleet,
  Levels,
  Mission,
  Planet,
  Resources,
} from '../../core/types.ts';
import { type AuditEntry, record } from '../audit.ts';
import { openDatabase } from '../db/database.ts';
import type { User } from '../db/repos/players.ts';
import { queuePush } from '../push-store.ts';
import { addPlanet, addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { type Action, type Data, mine, researchOf } from './actions.ts';
import * as N from './arrival.ts';
import {
  type Ctx,
  addReport,
  coords,
  fail,
  fmt,
  int,
  resLine,
  universe,
} from './context.ts';
import { send as sendNow } from './fleet-actions.ts';
import { createPlanet } from './planets.ts';
import { isProtected, pointsMap } from './points.ts';

// ---- reference: src/server/game/arrival.ts before #116 ----

const UNKNOWN = { name: 'Unbekannt', research: {}, rq: null };
type Player = Pick<User, 'name' | 'research' | 'rq'>;

const player = (ctx: Ctx, id: string): Player => ctx.players.get(id) ?? UNKNOWN;
const techAt = (p: Player, t: number): Levels => settleR(p, t).research;

function turnBack(ctx: Ctx, f: Fleet, change: Partial<Fleet> = {}): void {
  Object.assign(f, change, { state: 'back' });
  ctx.fleets.save(f);
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
  ctx.planets.save(t);
  const text = `Eine Flotte von ${att.name} erreicht ${t.name} ${coords(f.toC)} und liefert ${resLine(f.cargo)}.`;
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Transport erreicht ${coords(f.toC)}`,
      participants: [f.owner, t.owner],
      text,
    },
    { topic: 'fleet' },
  );
  if (t.owner !== f.owner)
    addReport(
      ctx,
      t.owner,
      {
        time: f.arr,
        type: 'info',
        title: `Lieferung von ${att.name}`,
        participants: [f.owner, t.owner],
        text,
      },
      { topic: 'delivery' },
    );
  turnBack(ctx, f, { cargo: { m: 0, c: 0, d: 0 } });
}

/** How much a spy report shows: more probes and better technology show more. */
function spyScore(probes: number, diff: number): number {
  return probes + Math.sign(diff) * diff * diff;
}

function counterChance(defShips: number, diff: number): number {
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
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'spy',
      title: `Auspex-Bericht von ${t.name} ${coords(f.toC)}`,
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
    },
    { topic: 'fleet' },
  );
  const text = `Eine fremde Flotte von ${att.name} ${coords(f.fromC)} wurde in der Nähe deines Planeten ${t.name} ${coords(f.toC)} gesichtet. Chance auf Auspex-Abwehr: ${chance} %.${lost ? ' Die Spähschädel wurden abgeschossen!' : ''}`;
  addReport(
    ctx,
    t.owner,
    {
      time: f.arr,
      type: 'info',
      title: 'Auspex-Aktivität',
      participants: [f.owner, t.owner],
      text,
    },
    { topic: 'spied' },
  );
  if (lost) ctx.fleets.delete(f.id);
  else turnBack(ctx, f);
}

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
function rebuild(lost: number, rng: () => number): number {
  if (lost <= 0) return 0;
  if (lost >= 50) return Math.round(lost * 0.7);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < 0.7) n++;
  return n;
}

/** The winner takes up to half of each resource, as much as the holds carry. */
function plunder(stock: Resources, free: number): Resources {
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

// The debris rule of #45, written here on its own and not taken from
// src/core/debris.ts or the repository `debris`, so that the comparison
// fails when the rule changes (owner, 2026-11-14): 30 % of the Adamant and
// Psikristall of the ships both sides lost, Sonnenreliquiare included, no
// defense, no Promethium, added to the field at the position.
const REF_DEBRIS_SHARE = 0.3;

function refDebris(sides: [before: Levels, after: Levels][]): {
  m: number;
  c: number;
} {
  let m = 0;
  let c = 0;
  for (const [before, after] of sides)
    for (const [k, n] of Object.entries(before)) {
      const lost = n - (after[k] ?? 0);
      if (!Object.hasOwn(SHIPS, k) || lost <= 0) continue;
      m += SHIPS[k]!.cost[0] * lost;
      c += SHIPS[k]!.cost[1] * lost;
    }
  return { m: m * REF_DEBRIS_SHARE, c: c * REF_DEBRIS_SHARE };
}

/** Adds the debris to the field at the position; nothing makes no field. */
function refLeaveDebris(
  ctx: Ctx,
  { g, s, p }: Coords,
  d: { m: number; c: number },
): void {
  if (d.m <= 0 && d.c <= 0) return;
  ctx.db
    .prepare(
      `INSERT INTO debris (id, g, s, p, res_m, res_c) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET res_m = res_m + excluded.res_m,
         res_c = res_c + excluded.res_c`,
    )
    .run(`d${g}_${s}_${p}`, g, s, p, d.m, d.c);
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
  debris: { m: number; c: number };
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

function attack(ctx: Ctx, f: Fleet, t: Planet, att: Player, def: Player): void {
  const attR = techAt(att, f.arr);
  const defR = techAt(def, f.arr);
  const defBefore = { ...t.ships, ...t.def };
  const res = battle(
    { units: f.ships, tech: attR },
    { units: defBefore, tech: defR },
    ctx.rng,
  );
  const debris = refDebris([
    [f.ships, res.att],
    [defBefore, res.def],
  ]);
  refLeaveDebris(ctx, f.toC, debris);
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

function unsuitableTarget(ctx: Ctx, f: Fleet): void {
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: 'Flotte kehrt um',
      text: `An ${coords(f.toC)} wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.`,
    },
    { topic: 'fleet' },
  );
  turnBack(ctx, f);
}

function colonize(ctx: Ctx, f: Fleet, occupied: Planet | null): void {
  const u = universe(ctx);
  const { g, s, p } = f.toC;
  if (occupied || g > u.galaxies || s > u.systems || p > u.positions)
    return unsuitableTarget(ctx, f);
  createPlanet(ctx, f.owner, 'Kolonie', f.toC, f.arr, f.cargo);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Kolonie gegründet ${coords(f.toC)}`,
      text: 'Deine Kolonistenarche hat eine neue Kolonie gegründet.',
    },
    { topic: 'fleet' },
  );
  const ships = { ...f.ships };
  if (ships.colony === 1) delete ships.colony;
  else ships.colony = ships.colony! - 1;
  if (!countUnits(ships)) return ctx.fleets.delete(f.id);
  turnBack(ctx, f, { ships, cargo: { m: 0, c: 0, d: 0 } });
}

/**
 * A deploy stays at the target with its ships and cargo, plus half of the
 * fuel it burnt, rounded down; the fleet ends there (#129).
 */
function deploy(ctx: Ctx, f: Fleet, t: Planet): void {
  const rest = deployFuel(f.fuel);
  const load = { ...f.cargo, d: f.cargo.d + rest };
  land(t, f.ships, load);
  ctx.planets.save(t);
  addReport(
    ctx,
    f.owner,
    {
      time: f.arr,
      type: 'info',
      title: `Verlegung erreicht ${coords(f.toC)}`,
      text: `Deine Flotte bleibt auf ${t.name} ${coords(f.toC)} und liefert ${resLine(load)}, davon ${fmt(rest)} übriger Treibstoff.`,
    },
    { topic: 'fleet' },
  );
  ctx.fleets.delete(f.id);
}

/** A deploy needs an own planet, a transport any, the others a foreign one. */
function fits(f: Fleet, t: Planet | null): t is Planet {
  if (!t) return false;
  if (f.mission === 'transport') return true;
  return (t.owner === f.owner) === (f.mission === 'deploy');
}

function arrive(ctx: Ctx, f: Fleet): void {
  const t0 = ctx.planets.get(f.to);
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

function comeHome(ctx: Ctx, f: Fleet): void {
  const o0 = ctx.planets.get(f.from);
  if (o0 && o0.owner === f.owner) {
    const o = settle(o0, f.ret, universe(ctx), player(ctx, f.owner));
    land(o, f.ships, f.cargo);
    ctx.planets.save(o);
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
        { topic: 'fleet', kind: 'fleet' },
      );
    else
      queuePush(ctx, f.owner, {
        kind: 'fleet',
        topic: 'fleet',
        key: f.id,
        due: ctx.now(),
      });
  }
  ctx.fleets.delete(f.id);
}

// ---- reference: sending in src/server/game/fleet-actions.ts before #116 ----

const pickShips = (p: Planet, wanted: unknown): Levels => {
  const ships: Levels = {};
  for (const [k, n] of Object.entries((wanted as Levels | null) ?? {})) {
    if (!isShip(k)) continue;
    const m = Math.min(int(n, 0, 1e12), p.ships[k] ?? 0);
    if (m <= 0) continue;
    if (!canFly(k)) fail('Sonnenreliquiare können nicht fliegen.');
    ships[k] = m;
  }
  return ships;
};

const target = (ctx: Ctx, d: Data): Coords => {
  const u = universe(ctx);
  const to = (d.to as Partial<Coords> | null) ?? {};
  return {
    g: int(to.g, 1, u.galaxies),
    s: int(to.s, 1, u.systems),
    p: int(to.p, 1, u.positions),
  };
};

function checkTarget(
  ctx: Ctx,
  u: User,
  p: Planet,
  to: Planet,
  mission: Mission,
): void {
  if (to.id === p.id) fail('Das ist dein eigener Planet.');
  if (mission === 'transport') return;
  if (mission === 'deploy') {
    if (to.owner !== u.id) fail('Verlegung nur zu einem eigenen Planeten.');
    return;
  }
  if (to.owner === u.id) fail('Eigene Planeten kann man nicht angreifen.');
  if (isProtected(u.id, to.owner, pointsMap(ctx)))
    fail('Dieser Spieler steht unter Noobschutz.');
}

const loadCargo = (p: Planet, mission: Mission, raw: unknown): Resources => {
  if (mission === 'spy') return { m: 0, c: 0, d: 0 };
  const c = (raw as Partial<Resources> | null) ?? {};
  return {
    m: Math.min(int(c.m, 0, 1e15), Math.floor(p.res.m)),
    c: Math.min(int(c.c, 0, 1e15), Math.floor(p.res.c)),
    d: int(c.d, 0, 1e15),
  };
};

interface Plan {
  mission: Mission;
  ships: Levels;
  dest: Coords;
  targetOwner: string | null;
  cargo: Resources;
  pct: number;
}

function checkDestination(
  ctx: Ctx,
  u: User,
  p: Planet,
  mission: Mission,
  occupied: Planet | null,
  ships: Levels,
): void {
  if (mission === 'colonize') {
    if (occupied) fail('Diese Position ist bereits besetzt.');
    if (!ships.colony) fail('Du brauchst eine Kolonistenarche.');
  } else {
    checkTarget(
      ctx,
      u,
      p,
      occupied ?? fail('An dieser Position gibt es keinen Planeten.'),
      mission,
    );
  }
}

function plan(ctx: Ctx, u: User, p: Planet, d: Data): Plan {
  const mission = String(d.mission) as Mission;
  if (!Object.hasOwn(MISSION, mission)) fail('Unbekannter Auftrag.');
  const ships = pickShips(p, d.ships);
  if (!countUnits(ships)) fail('Keine Schiffe ausgewählt.');
  if (ctx.fleets.count(u.id) >= fleetSlots(researchOf(ctx, u)))
    fail('Alle Flottenslots belegt.');
  const dest = target(ctx, d);
  const occupied = ctx.planets.get(placeId({ ...dest, kind: 'planet' }));
  checkDestination(ctx, u, p, mission, occupied, ships);
  if (mission === 'spy' && Object.keys(ships).some((k) => k !== 'probe'))
    fail('Auspex-Erkundung nur mit Spähschädeln.');
  return {
    mission,
    ships,
    dest,
    targetOwner: occupied?.owner ?? null,
    cargo: loadCargo(p, mission, d.cargo),
    pct: int(d.pct, 1, 10),
  };
}

const send: Action = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const { mission, ships, dest, targetOwner, cargo, pct } = plan(ctx, u, p, d);
  const dist = distance(p, dest);
  const ms = flightMs(
    dist,
    fleetSpeed(ships, researchOf(ctx, u)),
    pct,
    universe(ctx),
  );
  const fuel = fuelFor(ships, dist, pct);
  if (cargo.m + cargo.c + cargo.d > capacity(ships))
    fail('Nicht genug Laderaum.');
  if (p.res.d < fuel + cargo.d)
    fail('Nicht genug Promethium für Treibstoff und Ladung.');
  for (const [k, n] of Object.entries(ships))
    p.ships[k] = (p.ships[k] ?? 0) - n;
  p.res.m -= cargo.m;
  p.res.c -= cargo.c;
  p.res.d -= cargo.d + fuel;
  ctx.planets.save(p);
  const fleet: Fleet = {
    id: ctx.id(),
    owner: u.id,
    from: p.id,
    fromC: { g: p.g, s: p.s, p: p.p },
    to: placeId({ ...dest, kind: 'planet' }),
    toC: dest,
    mission,
    ships,
    cargo,
    dep: t,
    arr: t + ms,
    ret: t + 2 * ms,
    state: 'out',
    recalled: false,
    fuel,
  };
  ctx.fleets.save(fleet);
  if (event) logLaunch(event, fleet, targetOwner);
  return `Flotte unterwegs nach ${coords(fleet.toC)}.`;
};

function logLaunch(
  event: AuditEntry,
  fleet: Fleet,
  target: string | null,
): void {
  if (target !== null) event.target = target;
  event.detail = {
    fleet: fleet.id,
    planet: fleet.to,
    origin: fleet.from,
    mission: fleet.mission,
    due: fleet.arr,
  };
}

// ---- the property test ----

const TEMPLATE = openDatabase(':memory:').serialize();
const NOW = 1_000_000;
/**
 * The missions the reference knows: those before #45. The Bergung of #45
 * has its own tests (src/features/missions/harvest/).
 */
const MISSIONS: Mission[] = [
  'attack',
  'transport',
  'spy',
  'colonize',
  'deploy',
];
/**
 * The ships before #45, so that the generated cases stay those of #116
 * (the generators draw from these lists).
 */
const SHIP_KEYS = Object.keys(SHIPS).filter((k) => k !== 'recycler');
const FLYING = SHIP_KEYS.filter(canFly);
const TECH = ['spy', 'weapons', 'shield', 'armor', 'computer', 'comb'];

/** Anna sends; Bert is as strong as she is, Cora has nothing (noob protection). */
interface World {
  seed: number;
  /** The building level of Anna's and Bert's planets: their points. */
  build: number;
  annaTech: Levels;
  defTech: Levels;
  /** The ships Anna has at home. */
  home: Levels;
  /** Ships, defense and stock of every target planet. */
  ships: Levels;
  def: Levels;
  res: Resources;
}

/** Where a fleet flies: a planet of Anna, Bert or Cora, or a free position. */
const TARGETS = {
  own: { g: 1, s: 1, p: 7 },
  same: { g: 1, s: 1, p: 5 },
  bert: { g: 1, s: 2, p: 6 },
  cora: { g: 1, s: 3, p: 6 },
  free: { g: 1, s: 4, p: 8 },
  outside: { g: 3, s: 1, p: 1 },
} as const;
type Target = keyof typeof TARGETS;

function world(w: World): { ctx: TestCtx; anna: User } {
  const db = new Database(TEMPLATE);
  db.pragma('foreign_keys = ON');
  const ctx = testCtx(NOW, w.seed, db);
  const anna = addUser(ctx, 'Anna', { research: w.annaTech });
  addUser(ctx, 'Bert', { research: w.defTech });
  addUser(ctx, 'Cora', { research: w.defTech });
  const b = { metal: w.build, crystal: w.build };
  const at = { ships: w.ships, def: w.def, res: w.res };
  const home = { colony: 2, ...w.home };
  addPlanet(ctx, anna.id, { ...TARGETS.same, b, ships: home });
  addPlanet(ctx, anna.id, { ...TARGETS.own, ...at, name: 'Kolonie' });
  addPlanet(ctx, 'u_Bert', { ...TARGETS.bert, ...at, b, name: 'Beta' });
  addPlanet(ctx, 'u_Cora', { ...TARGETS.cora, ...at, name: 'Gamma' });
  return { ctx, anna };
}

/** Every table of the database, row by row. */
function dump(ctx: Ctx): Record<string, unknown[]> {
  const tables = ctx.db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [
      name,
      ctx.db.prepare(`SELECT * FROM "${name}"`).all(),
    ]),
  );
}

const levels = (keys: readonly string[], max: number) =>
  fc
    .array(fc.tuple(fc.constantFrom(...keys), fc.integer({ min: 0, max })), {
      maxLength: keys.length,
    })
    .map((pairs) => Object.fromEntries(pairs.filter(([, n]) => n > 0)));

const stock = fc.record({
  m: fc.double({ min: 0, max: 1e6, noNaN: true }),
  c: fc.double({ min: 0, max: 1e6, noNaN: true }),
  d: fc.double({ min: 0, max: 1e6, noNaN: true }),
});

const worlds: fc.Arbitrary<World> = fc.record({
  seed: fc.integer({ min: 1, max: 2 ** 31 - 1 }),
  build: fc.constantFrom(0, 3, 12),
  annaTech: levels(TECH, 12),
  defTech: levels(TECH, 12),
  home: levels(SHIP_KEYS, 40),
  ships: levels(SHIP_KEYS, 30),
  def: levels(Object.keys(DEF), 60),
  res: stock,
});

const missions = fc.constantFrom(...MISSIONS);
const targets = fc.constantFrom(...(Object.keys(TARGETS) as Target[]));

type Arrive = (ctx: Ctx, f: Fleet) => void;

interface Flight {
  mission: Mission;
  target: Target;
  ships: Levels;
  cargo: Resources;
  fuel: number;
  /** Called back before the arrival: it only comes home. */
  recalled: boolean;
}

const flights: fc.Arbitrary<Flight> = fc
  .record({
    mission: missions,
    target: targets,
    ships: levels(FLYING, 25),
    cargo: fc.record({
      m: fc.integer({ min: 0, max: 50000 }),
      c: fc.integer({ min: 0, max: 50000 }),
      d: fc.integer({ min: 0, max: 50000 }),
    }),
    fuel: fc.integer({ min: 0, max: 9999 }),
    recalled: fc.boolean(),
  })
  // A fleet always has ships, a colony fleet a Kolonistenarche (the send checks).
  .map((x) => ({
    ...x,
    ships:
      x.mission === 'colonize'
        ? { ...x.ships, colony: x.ships.colony ?? 1 }
        : { lc: 1, ...x.ships },
  }));

/** One flight from Anna's home: arrival, then coming home at its return. */
function fly(w: World, x: Flight, arrive: Arrive, comeHome: Arrive) {
  const { ctx } = world(w);
  const toC = TARGETS[x.target];
  ctx.fleets.save({
    id: 'f1',
    owner: 'u_Anna',
    from: placeId({ ...TARGETS.same, kind: 'planet' }),
    fromC: TARGETS.same,
    to: placeId({ ...toC, kind: 'planet' }),
    toC,
    mission: x.mission,
    ships: x.ships,
    cargo: x.cargo,
    dep: NOW - 5000,
    arr: NOW,
    ret: NOW + 5000,
    state: x.recalled ? 'back' : 'out',
    recalled: x.recalled,
    fuel: x.fuel,
  });
  const steps: unknown[] = [];
  const step = (run: () => void): void => {
    try {
      run();
      steps.push('ok');
    } catch (e) {
      steps.push(String(e));
    }
    steps.push(dump(ctx));
  };
  if (!x.recalled) step(() => arrive(ctx, ctx.fleets.get('f1')!));
  const back = ctx.fleets.get('f1');
  if (back?.state === 'back') {
    ctx.clock.t = back.ret;
    step(() => comeHome(ctx, back));
  }
  const next = ctx.rng();
  ctx.db.close();
  return { steps, next };
}

/** Mostly a load that fits, sometimes more than any hold or stock. */
const load = fc.oneof(
  fc.integer({ min: -5, max: 1500 }),
  fc.integer({ min: 0, max: 400000 }),
);

interface Order {
  mission: string;
  target: Target;
  ships: Levels;
  cargo: Resources;
  pct: number;
  /** Fleets Anna already has in the air: the slots. */
  busy: number;
}

const orders: fc.Arbitrary<Order> = fc
  .record({
    mission: fc.oneof(
      { weight: 9, arbitrary: missions },
      { weight: 1, arbitrary: fc.constantFrom('nope', 'constructor', '') },
    ),
    target: targets,
    ships: levels([...SHIP_KEYS, 'nope'], 25),
    cargo: fc.record({ m: load, c: load, d: load }),
    pct: fc.integer({ min: 0, max: 11 }),
    busy: fc.constantFrom(0, 0, 1, 3),
    ark: fc.boolean(),
  })
  // Often a Kolonistenarche, or else a colony fleet rarely gets one.
  .map(({ ark, ...o }) =>
    ark ? { ...o, ships: { ...o.ships, colony: 1 } } : o,
  );

/** One order to send a fleet: the answer or the message, the event, the database. */
function order(w: World, o: Order, act: Action) {
  const { ctx, anna } = world(w);
  for (let i = 0; i < o.busy; i++)
    ctx.fleets.save({
      id: `busy${i}`,
      owner: anna.id,
      from: 'p1_1_5',
      fromC: TARGETS.same,
      to: 'p1_2_6',
      toC: TARGETS.bert,
      mission: 'transport',
      ships: { sc: 1 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: NOW,
      arr: NOW + 1e6,
      ret: NOW + 2e6,
      state: 'out',
      recalled: false,
      fuel: 1,
    });
  const event: AuditEntry = { category: 'game', action: 'send' };
  const d = {
    planet: 'p1_1_5',
    ships: o.ships,
    to: TARGETS[o.target],
    mission: o.mission,
    cargo: o.cargo,
    pct: o.pct,
  };
  let answer: unknown;
  try {
    answer = act(ctx, anna, d, event);
  } catch (e) {
    answer = `error: ${(e as Error).message}`;
  }
  const result = { answer, event, db: dump(ctx), next: ctx.rng() };
  ctx.db.close();
  return result;
}

// The reference knows the debris rule of #45, so the comparison takes every
// table and report as they are, debris rows and the report field `debris`
// included. `checkDebris` checks them once more on their own: they hold
// exactly 30 % of the ships the report lists as lost, and only a battle
// leaves a field.

type Dump = Record<string, unknown[]>;
type ReportRow = { type: string; body: string };

const isDump = (x: unknown): x is Dump =>
  typeof x === 'object' && x !== null && 'debris' in x;

/**
 * The Trümmerfeld after a flight: the losses of its battle report, or none.
 * Whether the flight left a field.
 */
function checkDebris(x: Flight, r: ReturnType<typeof fly>): boolean {
  const last = r.steps.filter(isDump).at(-1)!;
  const battles = (last.reports as ReportRow[])
    .filter((row) => row.type === 'battle')
    .map((row) => JSON.parse(row.body) as Record<string, Levels | Debris>);
  if (!battles.length) {
    expect(last.debris).toEqual([]);
    return false;
  }
  expect(x.mission).toBe('attack');
  const b = battles[0]!;
  const debris = debrisOf([
    { before: b.attBefore as Levels, after: b.attAfter as Levels },
    { before: b.defBefore as Levels, after: b.defAfter as Levels },
  ]);
  for (const report of battles) expect(report.debris).toEqual(debris);
  const { g, s, p } = TARGETS[x.target];
  expect(last.debris).toEqual(
    isEmpty(debris)
      ? []
      : [
          {
            id: placeId({ g, s, p, kind: 'debris' }),
            g,
            s,
            p,
            res_m: debris.m,
            res_c: debris.c,
          },
        ],
  );
  return !isEmpty(debris);
}

// Every case closes its database: 1600 open in-memory databases filled the
// memory of a mutation shard with four test runners. About 3 s per case on
// a laptop, slower with coverage: the default limit of 5 s is too short.
describe(
  'missions as strategies (#116) against the code before',
  { timeout: 60_000 },
  () => {
    it('arrive and come home bit for bit, with the same random draws', () => {
      let fields = 0;
      fc.assert(
        fc.property(worlds, flights, (w, x) => {
          // N is today's code; arrive and comeHome are the reference above.
          const today = fly(w, x, N.arrive, N.comeHome);
          if (checkDebris(x, today)) fields++;
          expect(today).toEqual(fly(w, x, arrive, comeHome));
        }),
        { seed: 116, numRuns: 400 },
      );
      // The generated battles leave Trümmerfelder, so the comparison
      // covers the debris rows and the report field with values.
      expect(fields).toBeGreaterThan(0);
    });

    it('send with the same answers, messages and changes', () => {
      fc.assert(
        fc.property(worlds, orders, (w, o) => {
          expect(order(w, o, sendNow)).toEqual(order(w, o, send));
        }),
        { seed: 116, numRuns: 400 },
      );
    });

    it('meets every target, message and outcome in the generated cases', () => {
      const answers = new Set<unknown>();
      const titles = new Set<string>();
      fc.assert(
        fc.property(worlds, orders, (w, o) => {
          answers.add(order(w, o, sendNow).answer);
        }),
        { seed: 116, numRuns: 400 },
      );
      fc.assert(
        fc.property(worlds, flights, (w, x) => {
          const { ctx } = world(w);
          const toC = TARGETS[x.target];
          const f: Fleet = {
            id: 'f1',
            owner: 'u_Anna',
            from: 'p1_1_5',
            fromC: TARGETS.same,
            to: placeId({ ...toC, kind: 'planet' }),
            toC,
            mission: x.mission,
            ships: x.ships,
            cargo: x.cargo,
            dep: NOW - 5000,
            arr: NOW,
            ret: NOW + 5000,
            state: 'out',
            recalled: false,
            fuel: x.fuel,
          };
          ctx.fleets.save(f);
          N.arrive(ctx, f);
          for (const r of ctx.reports.ofPlayer('u_Anna'))
            titles.add(r.title.replace(/ .*/, ''));
          ctx.db.close();
        }),
        { seed: 116, numRuns: 400 },
      );
      expect([...answers].sort()).toEqual([
        'Flotte unterwegs nach [1:1:7].',
        'Flotte unterwegs nach [1:2:6].',
        'Flotte unterwegs nach [1:3:6].',
        'Flotte unterwegs nach [1:4:8].',
        'error: Alle Flottenslots belegt.',
        'error: An dieser Position gibt es keinen Planeten.',
        'error: Auspex-Erkundung nur mit Spähschädeln.',
        'error: Das ist dein eigener Planet.',
        'error: Diese Position ist bereits besetzt.',
        'error: Dieser Spieler steht unter Noobschutz.',
        'error: Du brauchst eine Kolonistenarche.',
        'error: Eigene Planeten kann man nicht angreifen.',
        'error: Keine Schiffe ausgewählt.',
        'error: Nicht genug Laderaum.',
        'error: Nicht genug Promethium für Treibstoff und Ladung.',
        'error: Sonnenreliquiare können nicht fliegen.',
        'error: Unbekannter Auftrag.',
        'error: Verlegung nur zu einem eigenen Planeten.',
      ]);
      expect([...titles].sort()).toEqual([
        'Auspex-Bericht',
        'Flotte',
        'Kampfbericht',
        'Kolonie',
        'Transport',
        'Verlegung',
      ]);
    });
  },
);
