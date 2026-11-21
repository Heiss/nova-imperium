// The jump through the Warp-Tor (#53, #230, okf/features/moons.md; owner,
// 2026-11-13, 2026-11-16 and 2026-11-17): from the gate of the active moon to another
// own moon with a ready Warp-Tor, the picked ships only, at once and without
// fuel; the resources stay. The checks are `jumpError` of
// src/core/jump-gate.ts. Both gates then cool down by the level of the
// starting gate, divided by the universe speed; the times are stored with the moons, so they hold after a
// restart. Checking, moving and storing run in the one transaction of
// `runAction`, so two requests can never move the same ships twice.
import {
  type Gate,
  type GateView,
  type JumpError,
  gateCooldownMs,
  gateLevel,
  jumpError,
  moveShips,
} from '../../core/jump-gate.ts';
import { parsePlaceId, placeId } from '../../core/place.ts';
import { settle } from '../../core/settle.ts';
import type { Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import { type Handler, mine } from './actions.ts';
import { type Ctx, fail, universe } from './context.ts';
import { pickedShips } from './fleet-actions.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape } from '../../core/state/jump-gate.ts';

/** The German message of each refusal [E] (owner, 2026-11-17). */
export const JUMP_ERROR: Readonly<Record<JumpError, string>> = {
  notMoon: 'Ein Sprung ist nur von einem Mond aus möglich.',
  noGate: 'Auf diesem Mond steht kein Warp-Tor.',
  cooling: 'Das Warp-Tor kühlt noch ab.',
  noTarget: 'Der Zielmond muss ein eigener Mond sein.',
  sameMoon: 'Start und Zielmond sind derselbe Mond.',
  targetNoGate: 'Auf dem Zielmond steht kein Warp-Tor.',
  targetCooling: 'Das Warp-Tor des Zielmonds kühlt noch ab.',
  noShips: 'Keine Schiffe ausgewählt.',
  stationary: 'Sonnenreliquiare können nicht springen.',
};

const gateOf = (ctx: Ctx, p: Planet): Gate => ({
  ...p,
  ready: ctx.planets.gateReady(p.id),
});

/** The target place of `id`, moved to now, or null when there is none. */
function targetOf(ctx: Ctx, u: User, id: unknown): Planet | null {
  const place = parsePlaceId(String(id));
  const p = place && ctx.planets.get(placeId(place));
  return p ? settle(p, ctx.now(), universe(ctx), u) : null;
}

/**
 * Jumps the ships `d.ships` from the active moon `d.planet` to the own moon
 * `d.to` (an id such as `m1_2_3`).
 */
const jump: Handler<'jump'> = (ctx, u, d, event) => {
  const now = ctx.now();
  const from = mine(ctx, u, d.planet);
  const to = targetOf(ctx, u, d.to);
  const ships = pickedShips(from, d.ships);
  const error = jumpError(gateOf(ctx, from), to && gateOf(ctx, to), ships, now);
  if (error) fail(JUMP_ERROR[error]);
  moveShips(from, to!, ships);
  ctx.planets.save(from);
  ctx.planets.save(to!);
  // Both gates cool down by the level of the starting gate and the speed.
  const ready = now + gateCooldownMs(gateLevel(from), universe(ctx));
  ctx.planets.setGateReady(from.id, ready);
  ctx.planets.setGateReady(to!.id, ready);
  if (event) event.detail = { planet: from.id, target: to!.id, ships };
  return null;
};

/**
 * Every Warp-Tor of the player, on the moons in their order. The places are
 * moved to now and not saved, as the labs of `ownLabs`: a Warp-Tor finished
 * since the last save is in the state with its new level.
 */
export const gateState = (ctx: Ctx, uid: string): GateView[] =>
  ctx.planets
    .ofOwner(uid)
    .map((p) => settle(p, ctx.now(), universe(ctx)))
    .filter((p) => gateLevel(p) > 0)
    .map((p) => ({
      id: p.id,
      level: gateLevel(p),
      ready: ctx.planets.gateReady(p.id),
    }));

export const serverFeature = {
  actions: { jump },
  // The own Warp-Tore with their readiness (#230).
  state: {
    order: 80,
    keys: ['gates'],
    build: (ctx, u) => ({ gates: gateState(ctx, u.id) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
