// The battle of a fleet at a planet and its consequences as a fixed pipeline
// (okf/architecture/patterns.md, section 5): the battle, the debris step
// (#45), the moon step (#53) and the rebuilt defense, then the audit entry.
// The Sturmangriff, the detected Auspex-Erkundung (#175 D4) and the Mondbruch
// (#95) share it; each mission words its own reports and moves its fleet. The
// Sturmangriff and the Mondbruch also share the loot, the two battle reports
// and the flight home (`raid`, `attackReports`, `flyHome`). The fleets that
// hold at a planet (#55) defend it in the Sturmangriff only, as it was built:
// the Sturmangriff passes them (`defenders`), the Mondbruch and the detected
// Auspex-Erkundung fight without them.
import { type BattleResult, battleOf } from '../../core/battle.ts';
import { DEF, SHIPS, fights } from '../../core/catalog.ts';
import { type Debris, debrisOf, isEmpty } from '../../core/debris.ts';
import { capacity, countUnits } from '../../core/flight.ts';
import { cargoOf } from '../../core/holding.ts';
import { placeName } from '../../core/moon.ts';
import type { Fleet, Levels, Planet, Resources } from '../../core/types.ts';
import { record } from '../audit.ts';
import { type Ctx, addReport, coords } from './context.ts';
import { heldAt } from './holding.ts';
import {
  type Arrival,
  type Player,
  playerOf,
  researchAt,
  techAt,
  turnBack,
} from './missions.ts';
import { type MoonRoll, rollMoon } from './moons.ts';

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
export function rebuild(lost: number, rng: () => number): number {
  if (lost <= 0) return 0;
  if (lost >= 50) return Math.round(lost * 0.7);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < 0.7) n++;
  return n;
}

/**
 * Fills `free` cargo space from `avail` in the order of the classic loot:
 * a third Adamant, half of the rest Psikristall, the rest Promethium, then
 * what is left over, Adamant first.
 */
function fill(avail: Resources, free: number): Resources {
  let cap = free;
  const loot = { m: 0, c: 0, d: 0 };
  const take = (k: keyof Resources, limit: number): void => {
    const v = Math.max(0, Math.floor(Math.min(avail[k] - loot[k], limit)));
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

/**
 * The winner takes up to half of each resource, as much as the holds carry;
 * of the cargo of the fleets that held at the planet all of it (`share` 1,
 * #55).
 */
export const plunder = (
  stock: Resources,
  free: number,
  share = 0.5,
): Resources =>
  fill({ m: stock.m * share, c: stock.c * share, d: stock.d * share }, free);

/**
 * Loot cut to the holds that are left (#95; owner, 2026-11-16): what no
 * longer fits is lost, in the order of the loot.
 */
export const cutLoot = (loot: Resources, free: number): Resources =>
  fill(loot, free);

/** The defense that fights: every one but the missiles (#54). */
const fighting = (def: Levels): Levels =>
  Object.fromEntries(Object.entries(def).filter(([k]) => fights(k)));

/** The defense that does not fight, the missiles, as far as there is any (#54). */
const idle = (def: Levels): Levels =>
  Object.fromEntries(
    Object.keys(DEF)
      .filter((k) => !fights(k) && def[k])
      .map((k) => [k, def[k]!]),
  );

function afterBattle(
  ctx: Ctx,
  t: Planet,
  after: Levels,
): { rebuilt: Levels; def: Levels; ships: Levels } {
  const rebuilt: Levels = {};
  const def: Levels = {};
  const ships: Levels = {};
  for (const k of Object.keys(DEF).filter(fights)) {
    const left = after[k] ?? 0;
    const rb = rebuild((t.def[k] ?? 0) - left, ctx.rng);
    if (rb) rebuilt[k] = rb;
    if (left + rb) def[k] = left + rb;
  }
  // Missiles do not fight and stay as they are (#54).
  Object.assign(def, idle(t.def));
  for (const k of Object.keys(SHIPS)) if (after[k]) ships[k] = after[k];
  return { rebuilt, def, ships };
}

const tech = (r: Levels): Levels => ({
  weapons: r.weapons ?? 0,
  shield: r.shield ?? 0,
  armor: r.armor ?? 0,
});

/** A fleet that holds at the planet and fights for it (#55). */
export interface Held {
  f: Fleet;
  player: Player;
  tech: Levels;
}

/** A fleet that held and fought: what is left of it. */
interface HeldFight extends Held {
  after: Levels;
}

/**
 * The fleets that hold at the planet and defend it (#55); a fleet of the
 * attacker himself that holds there stays out of the battle [V].
 */
export const defenders = (ctx: Ctx, f: Fleet, t: Planet): Held[] =>
  heldAt(ctx, t.id)
    .filter((h) => h.owner !== f.owner)
    .map((h) => {
      const player = playerOf(ctx, h.owner);
      return { f: h, player, tech: techAt(player, f.arr) };
    });

/** The owners of the fleets that held, each once, in the order of their fleets. */
const heldOwners = (held: readonly Held[]): string[] => [
  ...new Set(held.map((h) => h.f.owner)),
];

/**
 * The debris step: 30 % of the ships every party lost lie at the position
 * (#45), those of the fleets that held too (#55).
 */
function leaveDebris(
  ctx: Ctx,
  f: Fleet,
  defBefore: Levels,
  res: BattleResult,
  held: readonly HeldFight[],
): Debris {
  const debris = debrisOf([
    { before: f.ships, after: res.att },
    { before: defBefore, after: res.def },
    ...held.map((h) => ({ before: h.f.ships, after: h.after })),
  ]);
  if (!isEmpty(debris)) ctx.debris.add(f.toC, debris);
  return debris;
}

/**
 * A battle at a planet and what followed it. `res` is the battle of the
 * attacker and the owner; every fleet that held fought as a party of its own
 * (#55) and has its `after` in `held`.
 */
export interface Fight {
  res: BattleResult;
  held: HeldFight[];
  defBefore: Levels;
  rebuilt: Levels;
  debris: Debris;
  moon: MoonRoll;
  attTech: Levels;
  defTech: Levels;
}

/**
 * The fleet fights the ships and the defense of the target, and the fleets
 * that hold there with them: the target keeps what survived and the rebuilt
 * defense, but is not saved yet, so that the mission can take its loot first.
 * With one party on each side the battle draws exactly as before.
 */
export function fight(
  ctx: Ctx,
  f: Fleet,
  at: Arrival,
  held: readonly Held[] = [],
): Fight {
  const { t } = at;
  const { attR, defR } = researchAt(at, f.arr);
  // Missiles do not fight: they are neither in the battle nor in its report (#54).
  const defBefore = { ...t.ships, ...fighting(t.def) };
  const parties = battleOf(
    [{ units: f.ships, tech: attR }],
    [
      { units: defBefore, tech: defR },
      ...held.map((h) => ({ units: h.f.ships, tech: h.tech })),
    ],
    ctx.rng,
  );
  const res: BattleResult = {
    winner: parties.winner,
    rounds: parties.rounds,
    att: parties.att[0]!,
    def: parties.def[0]!,
  };
  const fought = held.map((h, i) => ({ ...h, after: parties.def[i + 1]! }));
  const debris = leaveDebris(ctx, f, defBefore, res, fought);
  const moon = rollMoon(ctx, t, f.arr);
  const after = afterBattle(ctx, t, res.def);
  t.ships = after.ships;
  t.def = after.def;
  const attTech = tech(attR);
  const defTech = tech(defR);
  return {
    res,
    held: fought,
    defBefore,
    rebuilt: after.rebuilt,
    debris,
    moon,
    attTech,
    defTech,
  };
}

/** The audit entry of a battle, once the target is saved. */
export const recordBattle = (ctx: Ctx, f: Fleet, t: Planet, x: Fight): void =>
  record(ctx, {
    category: 'system',
    action: 'battle',
    actor: f.owner,
    target: t.owner,
    detail: {
      fleet: f.id,
      planet: t.id,
      winner: x.res.winner,
      scheduled: f.arr,
    },
  });

/** What the battle reports of both sides show, without their titles; the loot of an attack. */
export function battleReport(
  f: Fleet,
  at: Arrival,
  x: Fight,
  loot?: Resources,
) {
  const { t } = at;
  return {
    time: f.arr,
    type: 'battle' as const,
    participants: [f.owner, t.owner, ...heldOwners(x.held)],
    name: placeName(t),
    coords: f.toC,
    attName: at.att.name,
    defName: at.def.name,
    rounds: x.res.rounds,
    winner: x.res.winner,
    attBefore: f.ships,
    attAfter: x.res.att,
    defBefore: x.defBefore,
    defAfter: x.res.def,
    // Every fleet that held fights as a defender of its own (#55); a
    // battle without one reports as before.
    ...(x.held.length > 0 && {
      held: x.held.map((h) => ({
        name: h.player.name,
        before: h.f.ships,
        after: h.after,
        tech: tech(h.tech),
      })),
    }),
    rebuilt: x.rebuilt,
    ...(loot && { loot }),
    debris: x.debris,
    // Only a rolled moon chance is reported (owner, 2026-11-14).
    ...x.moon,
    attTech: x.attTech,
    defTech: x.defTech,
  };
}

/** The result of a battle from the attacker's side, as in its title. */
export const WON = {
  att: 'gewonnen',
  def: 'verloren',
  draw: 'unentschieden',
} as const;

/** A battle with the loot of the winner, the target saved and the audit entry written. */
export interface Raid extends Fight {
  loot: Resources;
}

/**
 * The loot of a won battle (owner, 2026-11-17): the classic half of the
 * planet's stock first, then the cargo of the fleets that held there with
 * the room that is left. Those fleets are destroyed when the attacker wins.
 */
function lootOf(t: Planet, held: readonly Held[], free: number): Resources {
  const planet = plunder(t.res, free);
  const left = free - total(planet);
  const cargo = plunder(cargoOf(held.map((h) => h.f)), left, 1);
  t.res.m -= planet.m;
  t.res.c -= planet.c;
  t.res.d -= planet.d;
  return addResources(planet, cargo);
}

/** The fleets that held keep their survivors and hold on; one without any is gone. */
function afterHeld(ctx: Ctx, held: readonly HeldFight[]): void {
  for (const h of held) {
    if (!countUnits(h.after)) ctx.fleets.delete(h.f.id);
    else ctx.fleets.save({ ...h.f, ships: h.after });
  }
}

/**
 * The battle of a Sturmangriff or a Mondbruch: the winner takes the loot
 * as far as the holds of the ships left carry it, the target is saved, the
 * fleets that held keep what survived, and the battle is recorded.
 */
export function raid(
  ctx: Ctx,
  f: Fleet,
  at: Arrival,
  held: readonly Held[] = [],
): Raid {
  const { t } = at;
  const x = fight(ctx, f, at, held);
  const free = capacity(x.res.att) - total(f.cargo);
  const loot =
    x.res.winner === 'att' ? lootOf(t, held, free) : { m: 0, c: 0, d: 0 };
  ctx.planets.save(t);
  afterHeld(ctx, x.held);
  recordBattle(ctx, f, t, x);
  return { ...x, loot };
}

/** What a mission adds to the battle report of each side (#95). */
export interface ReportExtra {
  att?: Record<string, unknown>;
  def?: Record<string, unknown>;
}

/** Both battle reports of a raid, with what the mission adds to each side. */
export function attackReports(
  ctx: Ctx,
  f: Fleet,
  at: Arrival,
  x: Raid,
  extra: ReportExtra = {},
): void {
  const { t, att } = at;
  const report = battleReport(f, at, x, x.loot);
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[x.res.winner]}`;
  addReport(
    ctx,
    f.owner,
    { ...report, ...extra.att, title: won },
    { topic: 'fleet' },
  );
  const hit = `Feindkontakt! ${placeName(t)} ${coords(f.toC)} wird von ${att.name} angegriffen`;
  addReport(
    ctx,
    t.owner,
    { ...report, ...extra.def, title: hit },
    { topic: 'attacked' },
  );
  // The owner of every fleet that held gets the report of the defender (#55).
  for (const owner of heldOwners(x.held))
    addReport(
      ctx,
      owner,
      { ...report, ...extra.def, title: hit },
      { topic: 'attacked' },
    );
}

/** The amount of a stock, all three resources. */
export const total = (r: Resources): number => r.m + r.c + r.d;

/** The sum of two stocks. */
export const addResources = (a: Resources, b: Resources): Resources => ({
  m: a.m + b.m,
  c: a.c + b.c,
  d: a.d + b.d,
});

/**
 * The ships left fly home with `cargo`, by default what they carried plus
 * the loot; a fleet without survivors is gone.
 */
export function flyHome(
  ctx: Ctx,
  f: Fleet,
  x: Raid,
  ships: Levels = x.res.att,
  cargo: Resources = addResources(f.cargo, x.loot),
): void {
  if (!countUnits(ships)) return ctx.fleets.delete(f.id);
  turnBack(ctx, f, { ships, cargo });
}
