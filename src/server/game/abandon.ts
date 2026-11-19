// Giving up a colony („Kolonie aufgeben“, #224, okf/features/abandon-colony.md):
// the player confirms with the password, like the deletion of the account;
// the rules are those of src/core/abandon.ts (patterns, section 7), and the
// server turns their codes into German messages. The planet and its moon go
// with everything on them (Q1); the position stays locked for colonization
// for the hours of the round (D2).
import {
  type AbandonError,
  type FlightRef,
  abandonError,
  positionLockEnd,
} from '../../core/abandon.ts';
import type { Planet } from '../../core/types.ts';
import { passwordMatches } from '../auth.ts';
import type { User } from '../db/repos/players.ts';
import type { Action } from './actions.ts';
import { type Ctx, coords, fail } from './context.ts';
import { mainPlanet } from './main-planet.ts';
import { moonAt } from './moons.ts';
import { roundRules } from './round.ts';
import type { ServerFeature } from './feature.ts';

/** The German message of each refusal [V]. */
export const ABANDON_ERROR: Readonly<Record<AbandonError, string>> = {
  unknown: 'Das ist keiner deiner Planeten.',
  moon: 'Ein Mond kann nicht allein aufgegeben werden.',
  main: 'Der Hauptplanet kann nicht aufgegeben werden. Wähle zuerst einen anderen Hauptplaneten.',
  stale: 'Diese Kolonie gibt es so nicht mehr.',
  flights:
    'Die Kolonie kann nicht aufgegeben werden, solange Flotten zu ihr oder ihrem Mond unterwegs sind oder von dort kommen.',
  research:
    'Die Kolonie kann nicht aufgegeben werden, solange dort geforscht wird.',
  orders:
    'Die Kolonie kann nicht aufgegeben werden, solange auf ihr oder ihrem Mond gebaut wird.',
};

/** The flights of every player that start from or fly to one of the places. */
const flightsAt = (ctx: Ctx, ids: string[]): FlightRef[] =>
  ctx.db
    .prepare(
      `SELECT from_planet AS "from", to_planet AS "to" FROM fleets
       WHERE from_planet IN (SELECT value FROM json_each(?))
          OR to_planet IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(ids), JSON.stringify(ids)) as FlightRef[];

/** The password like the deletion of the account, before anything else. */
function confirmPassword(u: User, password: unknown): void {
  if (typeof password !== 'string' || !passwordMatches(u, password))
    fail('Das bisherige Passwort ist falsch.');
}

/**
 * The planet `id` founded at `created` and its moon; refused unless they
 * can be given up now, before anything is deleted.
 */
function giveUpTarget(
  ctx: Ctx,
  u: User,
  id: unknown,
  created: unknown,
): { planet: Planet; moon: Planet | null } {
  const target = typeof id === 'string' ? ctx.planets.get(id) : null;
  const moon = target?.kind === 'planet' ? moonAt(ctx, target) : null;
  const places = [target, moon].flatMap((x) => (x ? [x.id] : []));
  const error = abandonError({
    target,
    created,
    moon,
    uid: u.id,
    main: mainPlanet(ctx, u)?.id ?? null,
    flights: flightsAt(ctx, places),
    research: u.rq?.planet ?? null,
  });
  if (error) fail(ABANDON_ERROR[error]);
  return { planet: target!, moon };
}

/** Gives up the own planet `d.target`, founded at `d.created`, with its moon after the password `d.password`. */
export const abandon: Action = (ctx, u, d, event) => {
  confirmPassword(u, d.password);
  const { planet, moon } = giveUpTarget(ctx, u, d.target, d.created);
  const until = positionLockEnd(ctx.now(), roundRules(ctx).abandonLock);
  if (moon) ctx.planets.delete(moon.id);
  ctx.planets.delete(planet.id);
  ctx.planets.lockPosition(planet, until);
  if (event)
    event.detail = { planet: planet.id, moon: moon?.id ?? null, until };
  return `Die Kolonie ${planet.name} ${coords(planet)} wurde aufgegeben.`;
};

export const serverFeature = {
  actions: { abandon },
} satisfies ServerFeature;
