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
  type TearDownError,
  tearDownError,
} from '../../core/missiles.ts';
import { placeId } from '../../core/place.ts';
import type { Fleet, Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Wire } from '../../core/actions.ts';
import { type Handler, mine, researchOf } from './actions.ts';
import { type Ctx, coords, fail, fmt, int, universe } from './context.ts';
import { text } from '../../core/text.ts';
import { route, target } from './fleet-actions.ts';
import { isProtected } from './points.ts';
import { exactPoints } from './scores.ts';
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
      // The exact points of the two players, never the stored pass (#405).
      protects: (o) => isProtected(u.id, o, exactPoints(ctx, [u.id, o])),
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

/** The German message of each refusal of a tear-down [V]: the count as for an order. */
export const TEAR_DOWN_ERROR: Readonly<Record<TearDownError, string>> = {
  unit: 'Ungültig.',
  count: 'Bitte eine Anzahl eingeben.',
  stock: 'Nicht so viele Raketen vorhanden.',
};

/**
 * Tears down `d.n` stored missiles of `d.key` on the selected own planet
 * (#54, owner, 2026-11-21): the missiles are gone at once, so their places
 * in the Raketenkrypta are free; it costs nothing and gives nothing back.
 * The check is `tearDownError` of the core; a refusal changes nothing.
 */
const tearDownMissiles: Handler<'tearDownMissiles'> = (ctx, u, d, event) => {
  const key = String(d.key);
  const p = mine(ctx, u, d.planet);
  const n = Number(d.n);
  const error = tearDownError(p, key, n);
  if (error) fail(TEAR_DOWN_ERROR[error]);
  p.def[key] = (p.def[key] ?? 0) - n;
  ctx.planets.save(p);
  if (event) event.detail = { planet: p.id, key, missiles: n };
  return `${fmt(n)}× ${text(key)!.n} verschrottet.`;
};

export const serverFeature = {
  actions: { missile, tearDownMissiles },
} satisfies ServerFeature;
