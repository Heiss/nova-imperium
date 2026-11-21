// Moons (#53, okf/features/moons.md): a new moon at a planet, after a battle
// by chance or by the admin. A moon is a row of the planets with the kind
// `moon` (#119, O11) and belongs to the owner of its planet; at most one per
// planet. It starts as „Mond“ with the temperature of its planet, without
// stock and without buildings (owner, 2026-11-13 and 2026-11-14).
import { SILO_MISSIONS } from '../../core/missions.ts';
import { placeId } from '../../core/place.ts';
import {
  formsMoon,
  MAX_MOON_CHANCE,
  MIN_MOON_CHANCE,
  moonChance,
  moonDiameter,
} from '../../core/moon.ts';
import type { Coords, Planet } from '../../core/types.ts';
import type { AuditEntry } from '../audit.ts';
import { cancelScheduledPush } from '../push-store.ts';
import { type Ctx, addReport, coords, fail, str } from './context.ts';
import { heldAt } from './holding.ts';

/** The name a new moon starts with; it is renamed like a planet. */
export const MOON_NAME = 'Mond';

/** The moon at the position of a planet, or null. */
export const moonAt = (ctx: Ctx, c: Coords): Planet | null =>
  ctx.planets.get(placeId({ g: c.g, s: c.s, p: c.p, kind: 'moon' }));

/** Puts a new moon at the planet; the chance in % decides its diameter. */
export function addMoon(
  ctx: Ctx,
  planet: Planet,
  chance: number,
  t: number,
): Planet {
  const { g, s, p } = planet;
  const moon: Planet = {
    id: placeId({ g, s, p, kind: 'moon' }),
    kind: 'moon',
    owner: planet.owner,
    name: MOON_NAME,
    g,
    s,
    p,
    temp: planet.temp,
    diameter: moonDiameter(chance, ctx.rng),
    unlimited: false,
    res: { m: 0, c: 0, d: 0 },
    b: {},
    ships: {},
    def: {},
    bq: null,
    sq: [],
    sqT: null,
    pct: {},
    t,
    created: t,
  };
  ctx.planets.save(moon);
  return moon;
}

/** What a battle report says about the moon: nothing, or the rolled chance. */
export type MoonRoll = { moonChance: number; moon: boolean } | null;

/**
 * The moon step after the debris step of a battle at `t` (okf/architecture/
 * patterns.md, section 5): at a planet without a moon, the chance from the
 * whole Trümmerfeld at the position is rolled once when it is above 0, and
 * on a hit the moon forms (owner, 2026-11-13 and 2026-11-14). A battle at a
 * moon rolls nothing.
 */
export function rollMoon(ctx: Ctx, t: Planet, time: number): MoonRoll {
  if (t.kind !== 'planet' || moonAt(ctx, t)) return null;
  const field = ctx.debris.get(
    placeId({ g: t.g, s: t.s, p: t.p, kind: 'debris' }),
  );
  const chance = field ? moonChance(field) : 0;
  if (chance <= 0) return null;
  const moon = formsMoon(chance, ctx.rng);
  if (moon) addMoon(ctx, t, chance, time);
  return { moonChance: chance, moon };
}

/**
 * „Mond anlegen“ in the player record of the admin (owner, 2026-11-14):
 * always a moon at a planet without one; the chance of 1 to 20 % only goes
 * into the diameter. The audit entry names the owner, the planet, the moon,
 * the chance and the diameter.
 */
export function createMoon(
  ctx: Ctx,
  body: Record<string, unknown>,
  entry: AuditEntry,
): Planet {
  const id = str(body.planet, 40);
  const planet = ctx.planets.get(id);
  if (!planet || planet.kind !== 'planet')
    return fail('Planet nicht gefunden.');
  entry.target = planet.owner;
  if (moonAt(ctx, planet)) return fail('Dieser Planet hat schon einen Mond.');
  const chance = Number(body.chance);
  if (
    !Number.isInteger(chance) ||
    chance < MIN_MOON_CHANCE ||
    chance > MAX_MOON_CHANCE
  )
    fail(
      `Die Mondchance muss zwischen ${MIN_MOON_CHANCE} und ${MAX_MOON_CHANCE} % liegen.`,
    );
  const moon = addMoon(ctx, planet, chance, ctx.now());
  entry.detail = {
    planet: planet.id,
    moon: moon.id,
    chance,
    diameter: moon.diameter,
  };
  return moon;
}

/**
 * A broken moon (#95; owner, 2026-11-13 and 2026-11-16): everything on it
 * is lost, its stock, buildings, ships, defense and queues, with the pushes
 * of its queues; it leaves no Trümmerfeld. Fleets flying to it land at its
 * planet, fleets that hold at it move to its planet and hold on there until
 * their time ends, even above the limits of the planet (owner, 2026-11-19),
 * their owners get an info report each, and fleets whose home it is come home to its planet [V]. Missiles
 * flying to it are not rerouted: with their target gone they are lost at the
 * arrival, as the missiles decide (#54) [V].
 */
export function destroyMoon(
  ctx: Ctx,
  moon: Planet,
  time: number = ctx.now(),
): void {
  const planet = placeId({ g: moon.g, s: moon.s, p: moon.p, kind: 'planet' });
  // The owner of every fleet that holds at the moon is told once per fleet
  // that it holds at the planet from now on [V] (owner, 2026-11-19).
  for (const f of heldAt(ctx, moon.id)) {
    const where = coords({ g: moon.g, s: moon.s, p: moon.p });
    addReport(
      ctx,
      f.owner,
      {
        time,
        type: 'info',
        title: `Wache wechselt zum Planeten ${where}`,
        text: `Der Mond ${where} wurde zerstört; deine Wache hält jetzt am Planeten.`,
      },
      { topic: 'fleet' },
    );
  }
  ctx.fleets.reroute(moon.id, planet, SILO_MISSIONS);
  ctx.planets.delete(moon.id);
  for (const kind of ['buildings', 'shipyard'] as const)
    cancelScheduledPush(ctx, moon.owner, kind, `${moon.id}:*`);
}
