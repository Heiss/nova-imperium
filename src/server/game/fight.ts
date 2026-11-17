// The battle of a fleet at a planet and its consequences as a fixed pipeline
// (okf/architecture/patterns.md, section 5): the battle, the debris step
// (#45), the moon step (#53) and the rebuilt defense, then the audit entry.
// The Sturmangriff and the detected Auspex-Erkundung (#175 D4) share it; each
// mission words its own reports and moves its fleet.
import { battle } from '../../core/battle.ts';
import { DEF, SHIPS } from '../../core/catalog.ts';
import { type Debris, debrisOf, isEmpty } from '../../core/debris.ts';
import { placeName } from '../../core/moon.ts';
import type { Fleet, Levels, Planet, Resources } from '../../core/types.ts';
import { record } from '../audit.ts';
import type { Ctx } from './context.ts';
import { type Arrival, researchAt } from './missions.ts';
import { type MoonRoll, rollMoon } from './moons.ts';

/** 70 % of the destroyed defense is rebuilt: by chance below 50 units, else rounded. */
export function rebuild(lost: number, rng: () => number): number {
  if (lost <= 0) return 0;
  if (lost >= 50) return Math.round(lost * 0.7);
  let n = 0;
  for (let i = 0; i < lost; i++) if (rng() < 0.7) n++;
  return n;
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

/** A battle at a planet and what followed it. */
export interface Fight {
  res: ReturnType<typeof battle>;
  defBefore: Levels;
  rebuilt: Levels;
  debris: Debris;
  moon: MoonRoll;
  attTech: Levels;
  defTech: Levels;
}

/**
 * The fleet fights the ships and the defense of the target: the target keeps
 * what survived and the rebuilt defense, but is not saved yet, so that the
 * mission can take its loot first.
 */
export function fight(ctx: Ctx, f: Fleet, at: Arrival): Fight {
  const { t } = at;
  const { attR, defR } = researchAt(at, f.arr);
  const defBefore = { ...t.ships, ...t.def };
  const res = battle(
    { units: f.ships, tech: attR },
    { units: defBefore, tech: defR },
    ctx.rng,
  );
  const debris = leaveDebris(ctx, f, defBefore, res);
  const moon = rollMoon(ctx, t, f.arr);
  const after = afterBattle(ctx, t, res.def);
  t.ships = after.ships;
  t.def = after.def;
  const attTech = tech(attR);
  const defTech = tech(defR);
  return {
    res,
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
    participants: [f.owner, t.owner],
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
