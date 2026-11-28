// The battle of a fleet at a planet and its consequences as a fixed pipeline
// (okf/architecture/patterns.md, section 5): the battle, the debris step
// (#45), the moon step (#53) and the rebuilt defense, then the audit entry.
// The Sturmangriff, the detected Auspex-Erkundung (#175 D4) and the Mondbruch
// (#95) share it; each mission words its own reports and moves its fleet. The
// Sturmangriff and the Mondbruch also share the loot, the two battle reports
// and the flight home (`raid`, `attackReports`, `flyHome`). The fleets that
// hold at a planet (#55) defend it in all three fights (owner, 2026-11-19):
// each mission passes them (`defenders`), and the fight lets them take part,
// leaves their debris and reports to every owner of one. Missiles do not
// fight.
import { type BattleResult, battleOf } from '../../core/battle.ts';
import { DEF, SHIPS, fights } from '../../core/catalog.ts';
import { type Debris, debrisOf, isEmpty } from '../../core/debris.ts';
import { capacity, countUnits } from '../../core/flight.ts';
import { cutLoot, plunder, rebuild } from '../../core/loot.ts';
import { placeName } from '../../core/moon.ts';
import { splitLoot } from '../../core/union.ts';
import type { Fleet, Levels, Planet, Resources } from '../../core/types.ts';
import { record } from '../audit.ts';
import { type Ctx, type ReportInput, addReport, coords } from './context.ts';
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

// The loot and the rebuilt defense are rules of the core (#288); the
// missions and their tests keep asking for them here.
export { cutLoot, plunder, rebuild };

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
 * attacker himself that holds there stays out of the battle [V], and so does
 * one of every player who attacks with him in a union (#225) [V].
 */
export const defenders = (
  ctx: Ctx,
  f: Fleet,
  t: Planet,
  attackers: readonly string[] = [f.owner],
): Held[] =>
  heldAt(ctx, t.id)
    .filter((h) => !attackers.includes(h.owner))
    .map((h) => {
      const player = playerOf(ctx, h.owner);
      return { f: h, player, tech: techAt(player, f.arr) };
    });

/**
 * A fleet that attacks together with the fleet of the battle, in an attack
 * union (#225): a party of its own on the attacker's side with its owner's
 * research.
 */
export interface Joined {
  f: Fleet;
  player: Player;
  tech: Levels;
}

/** A fleet that joined and fought: what is left of it. */
interface JoinedFight extends Joined {
  after: Levels;
}

/** The fleets of an attack union besides the one that leads the battle, with their owners' research at the arrival (#225). */
export const joinedOf = (
  ctx: Ctx,
  fleets: readonly Fleet[],
  arr: number,
): Joined[] =>
  fleets.map((f) => {
    const player = playerOf(ctx, f.owner);
    return { f, player, tech: techAt(player, arr) };
  });

/** The owners of the fleets that held, each once, in the order of their fleets. */
const heldOwners = (held: readonly Held[]): string[] => [
  ...new Set(held.map((h) => h.f.owner)),
];

/** The owners of the attacking fleets, each once, the leading fleet's owner first. */
const attackOwners = (f: Fleet, joined: readonly Joined[]): string[] => [
  ...new Set([f.owner, ...joined.map((j) => j.f.owner)]),
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
  joined: readonly JoinedFight[],
): Debris {
  const debris = debrisOf([
    { before: f.ships, after: res.att },
    ...joined.map((j) => ({ before: j.f.ships, after: j.after })),
    { before: defBefore, after: res.def },
    ...held.map((h) => ({ before: h.f.ships, after: h.after })),
  ]);
  if (!isEmpty(debris)) ctx.debris.add(f.toC, debris);
  return debris;
}

/**
 * A battle at a planet and what followed it. `res` is the battle of the
 * attacker and the owner; every fleet that held fought as a party of its own
 * (#55) and has its `after` in `held`; so does every fleet that attacked
 * with the first one in an attack union (#225), in `joined`.
 */
export interface Fight {
  res: BattleResult;
  held: HeldFight[];
  joined: JoinedFight[];
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
  joined: readonly Joined[] = [],
): Fight {
  const { t } = at;
  const { attR, defR } = researchAt(at, f.arr);
  // Missiles do not fight: they are neither in the battle nor in its report (#54).
  const defBefore = { ...t.ships, ...fighting(t.def) };
  const parties = battleOf(
    [
      { units: f.ships, tech: attR },
      ...joined.map((j) => ({ units: j.f.ships, tech: j.tech })),
    ],
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
  const together = joined.map((j, i) => ({ ...j, after: parties.att[i + 1]! }));
  const debris = leaveDebris(ctx, f, defBefore, res, fought, together);
  const moon = rollMoon(ctx, t, f.arr);
  const after = afterBattle(ctx, t, res.def);
  t.ships = after.ships;
  t.def = after.def;
  const attTech = tech(attR);
  const defTech = tech(defR);
  return {
    res,
    held: fought,
    joined: together,
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
      // The other fleets of an attack union (#225).
      ...(x.joined.length > 0 && { union: x.joined.map((j) => j.f.id) }),
    },
  });

/**
 * Every fleet that attacked with the first one fights as an attacker of its
 * own (#225), with its own share of the loot; a battle without one reports
 * as before.
 */
const attackerBlocks = (x: Fight, shares?: readonly Resources[]) =>
  x.joined.length === 0
    ? {}
    : {
        attackers: x.joined.map((j, i) => ({
          name: j.player.name,
          before: j.f.ships,
          after: j.after,
          tech: tech(j.tech),
          ...(shares && { loot: shares[i + 1] }),
        })),
        ...(shares && { attLoot: shares[0] }),
      };

/** What the battle reports of both sides show, without their titles; the loot of an attack. */
export function battleReport(
  f: Fleet,
  at: Arrival,
  x: Fight,
  loot?: Resources,
  shares?: readonly Resources[],
) {
  const { t } = at;
  return {
    time: f.arr,
    type: 'battle' as const,
    participants: [
      ...new Set([
        ...attackOwners(f, x.joined),
        t.owner,
        ...heldOwners(x.held),
      ]),
    ],
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
    ...attackerBlocks(x, shares),
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
  /** The whole loot. */
  loot: Resources;
  /**
   * The share of each attacking fleet, the leading one first (#225): the
   * loot split by free cargo space (owner, 2026-11-16, Q1). A fleet that
   * attacks alone has the whole loot.
   */
  shares: Resources[];
}

/**
 * The loot of a won battle (owner, 2026-11-17): the classic half of the
 * planet's stock. The cargo of the fleets that held there is no loot (#440,
 * 233b): those fleets are destroyed with it when the attacker wins.
 */
function lootOf(t: Planet, free: number): Resources {
  const planet = plunder(t.res, free);
  t.res.m -= planet.m;
  t.res.c -= planet.c;
  t.res.d -= planet.d;
  return planet;
}

/** The fleets that held keep their survivors and hold on; one without any is gone. */
export function afterHeld(ctx: Ctx, held: readonly HeldFight[]): void {
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
  joined: readonly Joined[] = [],
): Raid {
  const { t } = at;
  const x = fight(ctx, f, at, held, joined);
  // The holds of all attacking fleets together carry the loot (#225).
  const spaces = [
    freeSpace(f, x.res.att),
    ...x.joined.map((j) => freeSpace(j.f, j.after)),
  ];
  const free = spaces.reduce((sum, n) => sum + n, 0);
  const loot = x.res.winner === 'att' ? lootOf(t, free) : { m: 0, c: 0, d: 0 };
  ctx.planets.save(t);
  afterHeld(ctx, x.held);
  recordBattle(ctx, f, t, x);
  return {
    ...x,
    loot,
    shares: x.joined.length ? splitLoot(loot, spaces) : [loot],
  };
}

/** The cargo space a fleet has left with the ships that survived. */
const freeSpace = (f: Fleet, ships: Levels): number =>
  Math.max(0, capacity(ships) - total(f.cargo));

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
  const report = battleReport(
    f,
    at,
    x,
    x.loot,
    x.joined.length ? x.shares : undefined,
  );
  const won = `Kampfbericht ${coords(f.toC)} – ${WON[x.res.winner]}`;
  // The owner of every attacking fleet gets the report once (#225).
  for (const owner of attackOwners(f, x.joined))
    addReport(
      ctx,
      owner,
      { ...report, ...extra.att, title: won },
      { topic: 'fleet' },
    );
  const names = namesLine([att.name, ...x.joined.map((j) => j.player.name)]);
  const hit = `Feindkontakt! ${placeName(t)} ${coords(f.toC)} wird von ${names} angegriffen`;
  const defender = { ...report, ...extra.def, title: hit };
  addReport(ctx, t.owner, defender, { topic: 'attacked' });
  reportHeldOwners(ctx, x, defender, 'attacked');
}

/**
 * The owner of every fleet that held gets the report of the defender (#55),
 * once for all his fleets.
 */
export function reportHeldOwners(
  ctx: Ctx,
  x: Fight,
  report: ReportInput,
  topic: 'attacked' | 'spied',
): void {
  for (const owner of heldOwners(x.held))
    addReport(ctx, owner, report, { topic });
}

/** „A“, „A und B“, „A, B und C“: the names once each (#225). */
function namesLine(names: readonly string[]): string {
  const once = [...new Set(names)];
  return once.length < 2
    ? (once[0] ?? '')
    : `${once.slice(0, -1).join(', ')} und ${once[once.length - 1]}`;
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
  cargo: Resources = addResources(f.cargo, x.shares[0]!),
): void {
  if (!countUnits(ships)) return ctx.fleets.delete(f.id);
  turnBack(ctx, f, { ships, cargo });
}

/**
 * Every fleet of an attack union flies home with its own survivors and its
 * own share of the loot (#225); a fleet without survivors is gone, with its
 * cargo.
 */
export function flyHomeUnion(ctx: Ctx, f: Fleet, x: Raid): void {
  flyHome(ctx, f, x);
  x.joined.forEach((j, i) =>
    flyHome(ctx, j.f, x, j.after, addResources(j.f.cargo, x.shares[i + 1]!)),
  );
}
