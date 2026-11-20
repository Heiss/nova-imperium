// Places a new home planet: a random free position 4 to 12 in the wished
// galaxy, otherwise the first free position of the universe. A home planet
// has 163 fields, a colony a random number in the range of its position (#51).
// A surveyed position keeps the values of its survey (#190, D1).
import { colonyDiameter, HOME_DIAMETER } from '../../core/fields.ts';
import { placeId } from '../../core/place.ts';
import { rollTemp } from '../../core/survey.ts';
import type { Coords, Planet, Resources } from '../../core/types.ts';
import { lockedUntil } from './position-lock.ts';
import { type Ctx, fail, universe } from './context.ts';
import { joinRound } from './round-events.ts';

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
  // A given-up position stays locked for new home planets too (#224, D2).
  const free = (c: Coords): boolean =>
    !used.has(placeId({ ...c, kind: 'planet' })) &&
    lockedUntil(ctx, c, ctx.now()) === null;
  const c =
    randomSpot(ctx, gal, free) ??
    firstSpot(ctx, free) ??
    fail('Das Universum ist voll.');
  const u = universe(ctx);
  const home = createPlanet(
    ctx,
    owner,
    name,
    c,
    ctx.now(),
    { m: u.startMetal, c: u.startCrystal, d: u.startDeuterium },
    HOME_DIAMETER,
  );
  // The first place of a player in the round: the seat and the baseline (#235).
  joinRound(ctx, owner, 'home', [home]);
  return home;
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
  // The values of a survey, which the position no longer needs (D1).
  const surveyed = ctx.surveys.get(c);
  if (surveyed) ctx.surveys.delete(c);
  const temp = surveyed?.temp ?? rollTemp(c.p, ctx.rng);
  const planet: Planet = {
    id: placeId({ ...c, kind: 'planet' }),
    owner,
    name,
    ...c,
    kind: 'planet',
    temp,
    diameter: diameter ?? surveyed?.diameter ?? colonyDiameter(c.p, ctx.rng),
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
