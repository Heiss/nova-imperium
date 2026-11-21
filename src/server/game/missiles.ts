// The launch of Orbitalraketen (#54, okf/features/missiles.md): from the
// selected planet at a foreign planet or moon in range, `d.n` missiles with
// the main target `d.aim` (a defense key, or none). The checks are
// `launchError` of src/core/missiles.ts; a refusal costs nothing. The
// missiles leave the planet's defense and fly as a flight of the mission
// `missile`, which takes no fleet slot and cannot be recalled; they hit at
// the arrival (src/features/missions/missile/arrive.server.ts).
import {
  type LaunchError,
  launchError,
  missileFlightMs,
  STRIKER,
} from '../../core/missiles.ts';
import { placeId } from '../../core/place.ts';
import type { Fleet, Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Wire } from '../../core/actions.ts';
import { type Handler, mine, researchOf } from './actions.ts';
import { type Ctx, coords, fail, fmt, int, universe } from './context.ts';
import { route, target } from './fleet-actions.ts';
import { isProtected, pointsMap } from './points.ts';
import { inVacation } from './vacation.ts';
import type { ServerFeature } from './feature.ts';

/** The German message of each refusal: the fleet's where they say the same, else [V]. */
const LAUNCH_ERROR: Readonly<Record<LaunchError, string>> = {
  count: 'Bitte eine Anzahl eingeben.',
  noMissiles: 'Nicht genug Orbitalraketen.',
  aim: 'Unbekanntes Hauptziel.',
  noPlanet: 'An dieser Position gibt es keinen Planeten.',
  noMoon: 'An dieser Position gibt es keinen Mond.',
  ownTarget: 'Eigene Planeten kann man nicht angreifen.',
  outOfRange: 'Das Ziel liegt außerhalb der Reichweite der Orbitalraketen.',
  vacation: 'Dieser Spieler ist im Urlaubsmodus.',
  protected: 'Dieser Spieler steht unter Noobschutz.',
};

/** The main target: a key, or null when none is chosen. */
const aimOf = (d: { readonly aim?: unknown }): string | null =>
  d.aim === undefined || d.aim === null || d.aim === '' ? null : String(d.aim);

/** The launch the player asks for, checked; it fails with the message of a refusal. */
function checked(ctx: Ctx, u: User, p: Planet, d: Wire<'missile'>) {
  const dest = target(ctx, d);
  const kind =
    (d.to as { kind?: unknown } | null)?.kind === 'moon' ? 'moon' : 'planet';
  const to = placeId({ ...dest, kind });
  const owner = ctx.planets.get(to)?.owner;
  const n = int(d.n, 0, 1e9);
  const aim = aimOf(d);
  const error = launchError(
    { at: p, impulse: researchOf(ctx, u).research.impulse ?? 0 },
    {
      place: { ...dest, kind },
      owner,
      protects: (o) => isProtected(u.id, o, pointsMap(ctx)),
      vacation: inVacation(ctx),
    },
    n,
    aim,
  );
  if (error) fail(LAUNCH_ERROR[error]);
  return { dest, to, owner: owner!, n, aim };
}

const missile: Handler<'missile'> = (ctx, u, d, event) => {
  const t = ctx.now();
  const p = mine(ctx, u, d.planet);
  const { dest, to, owner, n, aim } = checked(ctx, u, p, d);
  p.def[STRIKER] = (p.def[STRIKER] ?? 0) - n;
  ctx.planets.save(p);
  const arr = t + missileFlightMs(p, dest, universe(ctx).speed);
  const fleet: Fleet = {
    ...route(ctx, u, p, to, dest),
    mission: 'missile',
    ships: { [STRIKER]: n },
    cargo: { m: 0, c: 0, d: 0 },
    dep: t,
    arr,
    // Missiles do not come back: the return is the arrival.
    ret: arr,
    state: 'out',
    recalled: false,
    fuel: 0,
    ...(aim !== null && { aim }),
  };
  ctx.fleets.save(fleet);
  if (event) {
    event.target = owner;
    event.detail = {
      fleet: fleet.id,
      planet: to,
      origin: p.id,
      missiles: n,
      due: fleet.arr,
    };
  }
  return `${fmt(n)} Orbitalraketen unterwegs nach ${coords(dest)}.`;
};

export const serverFeature = {
  actions: { missile },
} satisfies ServerFeature;
