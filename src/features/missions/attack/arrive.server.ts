// A Sturmangriff fights the ships and the defense of the target, and the
// fleets that hold there with them (#55): the winner takes loot, the
// destroyed ships leave a Trümmerfeld (#45), at a planet without a moon the
// whole field may form one (#53), 70 % of the destroyed defense is rebuilt,
// every party gets a battle report; a fleet without survivors is gone.
import { type PartiesResult, battleOf } from '../../../core/battle.ts';
import { DEF, SHIPS } from '../../../core/catalog.ts';
import { type Debris, debrisOf, isEmpty } from '../../../core/debris.ts';
import { capacity, countUnits } from '../../../core/flight.ts';
import { cargoOf } from '../../../core/holding.ts';
import { placeName } from '../../../core/moon.ts';
import type { Fleet, Levels, Planet, Resources } from '../../../core/types.ts';
import { record } from '../../../server/audit.ts';
import { type Ctx, addReport, coords } from '../../../server/game/context.ts';
import { heldAt } from '../../../server/game/holding.ts';
import {
  type Arrival,
  type Player,
  playerOf,
  researchAt,
  techAt,
  turnBack,
} from '../../../server/game/missions.ts';
import { type MoonRoll, rollMoon } from '../../../server/game/moons.ts';

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
export function rebuild(lost: number, rng: () => number): number {
  if (lost <= 0) return 0;
  if (lost >= 50) return Math.round(lost * 0.7);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < 0.7) n++;
  return n;
}

/**
 * The winner takes up to half of each resource, as much as the holds carry;
 * of the cargo of the fleets that held at the planet all of it (`share` 1,
 * #55).
 */
export function plunder(
  stock: Resources,
  free: number,
  share = 0.5,
): Resources {
  let cap = free;
  const loot = { m: 0, c: 0, d: 0 };
  const half = { m: stock.m * share, c: stock.c * share, d: stock.d * share };
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

/** A fleet that holds at the planet and fights for it (#55). */
interface Held {
  f: Fleet;
  player: Player;
  tech: Levels;
}

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
  res: PartiesResult;
  held: Held[];
  rebuilt: Levels;
  loot: Resources;
  debris: Debris;
  moon: MoonRoll;
}

/** The owners of the fleets that held, each once, in the order of their fleets. */
const heldOwners = (held: readonly Held[]): string[] => [
  ...new Set(held.map((h) => h.f.owner)),
];

function battleReports(ctx: Ctx, x: Fight): void {
  const { f, t } = x;
  const helpers = heldOwners(x.held);
  const report = {
    time: f.arr,
    type: 'battle' as const,
    participants: [f.owner, t.owner, ...helpers],
    name: placeName(t),
    coords: f.toC,
    attName: x.att.name,
    defName: x.def.name,
    rounds: x.res.rounds,
    winner: x.res.winner,
    attBefore: f.ships,
    attAfter: x.res.att[0],
    defBefore: x.defBefore,
    defAfter: x.res.def[0],
    // Every fleet that held fights as a defender of its own (#55); a
    // battle without one reports as before.
    ...(x.held.length > 0 && {
      held: x.held.map((h, i) => ({
        name: h.player.name,
        before: h.f.ships,
        after: x.res.def[i + 1],
        tech: tech(h.tech),
      })),
    }),
    rebuilt: x.rebuilt,
    loot: x.loot,
    debris: x.debris,
    // Only a rolled moon chance is reported (owner, 2026-11-14).
    ...x.moon,
    attTech: tech(x.attR),
    defTech: tech(x.defR),
  };
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[x.res.winner]}`;
  addReport(ctx, f.owner, { ...report, title: won }, { topic: 'fleet' });
  const hit = `Feindkontakt! ${placeName(t)} ${coords(f.toC)} wird von ${x.att.name} angegriffen`;
  addReport(ctx, t.owner, { ...report, title: hit }, { topic: 'attacked' });
  // The owner of every fleet that held gets the report of the defender (#55).
  for (const owner of helpers)
    addReport(ctx, owner, { ...report, title: hit }, { topic: 'attacked' });
}

/**
 * The debris step: 30 % of the ships every party lost lie at the position
 * (#45), those of the fleets that held too (#55).
 */
function leaveDebris(
  ctx: Ctx,
  f: Fleet,
  defBefore: Levels,
  held: readonly Held[],
  res: PartiesResult,
): Debris {
  const debris = debrisOf([
    { before: f.ships, after: res.att[0]! },
    { before: defBefore, after: res.def[0]! },
    ...held.map((h, i) => ({ before: h.f.ships, after: res.def[i + 1]! })),
  ]);
  if (!isEmpty(debris)) ctx.debris.add(f.toC, debris);
  return debris;
}

/**
 * The fleets that hold at the planet and defend it (#55); a fleet of the
 * attacker himself stays out of the battle [V].
 */
const defenders = (ctx: Ctx, f: Fleet, t: Planet): Held[] =>
  heldAt(ctx, t.id)
    .filter((h) => h.owner !== f.owner)
    .map((h) => {
      const player = playerOf(ctx, h.owner);
      return { f: h, player, tech: techAt(player, f.arr) };
    });

/**
 * The loot of a won battle (owner, 2026-11-17): the classic half of the
 * planet's stock first, then the cargo of the fleets that held there with
 * the room that is left. Those fleets are destroyed when the attacker wins.
 */
function lootOf(t: Planet, held: readonly Held[], free: number): Resources {
  const planet = plunder(t.res, free);
  const left = free - (planet.m + planet.c + planet.d);
  const cargo = plunder(cargoOf(held.map((h) => h.f)), left, 1);
  t.res.m -= planet.m;
  t.res.c -= planet.c;
  t.res.d -= planet.d;
  return {
    m: planet.m + cargo.m,
    c: planet.c + cargo.c,
    d: planet.d + cargo.d,
  };
}

/** The fleets that held keep their survivors and hold on; one without any is gone. */
function afterHeld(ctx: Ctx, held: readonly Held[], res: PartiesResult): void {
  held.forEach((h, i) => {
    const ships = res.def[i + 1]!;
    if (!countUnits(ships)) return ctx.fleets.delete(h.f.id);
    ctx.fleets.save({ ...h.f, ships });
  });
}

/** The battle: the attacker against the owner and every fleet that holds there (#55). */
const fight = (
  ctx: Ctx,
  f: Fleet,
  attR: Levels,
  defBefore: Levels,
  defR: Levels,
  held: readonly Held[],
): PartiesResult =>
  battleOf(
    [{ units: f.ships, tech: attR }],
    [
      { units: defBefore, tech: defR },
      ...held.map((h) => ({ units: h.f.ships, tech: h.tech })),
    ],
    ctx.rng,
  );

export function onArrive(ctx: Ctx, f: Fleet, at: Arrival): void {
  const { t, att, def } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const defBefore = { ...t.ships, ...t.def };
  const held = defenders(ctx, f, t);
  const res = fight(ctx, f, attR, defBefore, defR, held);
  const survivors = res.att[0]!;
  const debris = leaveDebris(ctx, f, defBefore, held, res);
  const moon = rollMoon(ctx, t, f.arr);
  const after = afterBattle(ctx, t, res.def[0]!);
  const free = capacity(survivors) - (f.cargo.m + f.cargo.c + f.cargo.d);
  const loot =
    res.winner === 'att' ? lootOf(t, held, free) : { m: 0, c: 0, d: 0 };
  t.ships = after.ships;
  t.def = after.def;
  ctx.planets.save(t);
  afterHeld(ctx, held, res);
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
    held,
    rebuilt: after.rebuilt,
    loot,
    debris,
    moon,
  });
  if (!countUnits(survivors)) return ctx.fleets.delete(f.id);
  const cargo = {
    m: f.cargo.m + loot.m,
    c: f.cargo.c + loot.c,
    d: f.cargo.d + loot.d,
  };
  turnBack(ctx, f, { ships: survivors, cargo });
}
