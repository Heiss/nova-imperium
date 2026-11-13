// Places a new home planet: a random free position 4 to 12 in the wished
// galaxy, otherwise the first free position of the universe. A home planet
// has 163 fields, a colony a random number in the range of its position (#51).
import { colonyDiameter, HOME_DIAMETER } from '../../core/fields.ts';
import { pid } from '../../core/flight.ts';
import type { Coords, Planet, Resources } from '../../core/types.ts';
import { type Ctx, fail, universe } from './context.ts';

const TRIES = 300;

function randomSpot(
  ctx: Ctx,
  gal: number,
  free: (c: Coords) => boolean,
): Coords | null {
  const u = universe(ctx);
  for (let i = 0; i < TRIES; i++) {
    const c = {
      g: gal,
      s: 1 + Math.floor(ctx.rng() * u.systems),
      p: 4 + Math.floor(ctx.rng() * 9),
    };
    if (free(c)) return c;
  }
  return null;
}

function firstSpot(ctx: Ctx, free: (c: Coords) => boolean): Coords | null {
  const u = universe(ctx);
  for (let g = 1; g <= u.galaxies; g++)
    for (let s = 1; s <= u.systems; s++)
      for (let p = 1; p <= u.positions; p++)
        if (free({ g, s, p })) return { g, s, p };
  return null;
}

export function placePlanet(
  ctx: Ctx,
  owner: string,
  name: string,
  gal: number,
): Planet {
  const used = new Set(ctx.planets.all().map((p) => p.id));
  const free = (c: Coords): boolean => !used.has(pid(c));
  const c =
    randomSpot(ctx, gal, free) ??
    firstSpot(ctx, free) ??
    fail('Das Universum ist voll.');
  const u = universe(ctx);
  return createPlanet(
    ctx,
    owner,
    name,
    c,
    ctx.now(),
    { m: u.startMetal, c: u.startCrystal, d: u.startDeuterium },
    HOME_DIAMETER,
  );
}

export function createPlanet(
  ctx: Ctx,
  owner: string,
  name: string,
  c: Coords,
  t: number,
  res: Resources,
  diameter?: number,
): Planet {
  const temp = Math.round(130 - (c.p - 1) * 10 + (ctx.rng() * 20 - 10));
  const planet: Planet = {
    id: pid(c),
    owner,
    name,
    ...c,
    temp,
    diameter: diameter ?? colonyDiameter(c.p, ctx.rng),
    unlimited: false,
    res,
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
  ctx.planets.save(planet);
  return planet;
}
