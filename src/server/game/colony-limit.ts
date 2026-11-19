// The limit of planets on the server (#237, okf/features/colonization.md): how
// many ordinary planets a player owns and how many Landnahmen they have on
// their way out, against the limit of the round and the research
// „Kolonialverwaltung“ the player has. The pure rules are in
// src/core/colony-limit.ts; the launch (fleet-actions.ts) and the arrival of
// a Landnahme (the folder of the mission) ask them here.
import {
  colonyRules,
  limitFor,
  limitText,
  type PlanetCount,
} from '../../core/colony-limit.ts';
import { missionRules } from '../../core/missions.ts';
import type { Levels } from '../../core/types.ts';
import { type Ctx, universe } from './context.ts';

/** The ordinary planets a player owns, the home planet included; a moon is another kind of place and does not count. */
export const ownedPlanets = (ctx: Ctx, owner: string): number =>
  ctx.planets.ofOwner(owner).filter((p) => p.kind === 'planet').length;

/**
 * The colonization fleets of a player that fly out and keep a slot until
 * they arrive (D3): a recalled fleet flies back and releases it, as one on
 * its way home does.
 */
export const flyingColonies = (ctx: Ctx, owner: string): number =>
  ctx.fleets
    .all()
    .filter(
      (f) =>
        f.owner === owner &&
        f.state === 'out' &&
        missionRules(f.mission)?.colonizes,
    ).length;

/** What a player has against the limit now. */
const planetCount = (ctx: Ctx, owner: string): PlanetCount => ({
  owned: ownedPlanets(ctx, owner),
  flying: flyingColonies(ctx, owner),
});

/** The limit of planets for a player with this research, or null for none. */
export const limitOf = (ctx: Ctx, research: Levels): number | null =>
  limitFor(colonyRules(universe(ctx)), research);

/** What a Landnahme asks at its launch: the limit and what the player has against it. */
export const colonyRoom = (
  ctx: Ctx,
  owner: string,
  research: Levels,
): { limit: number | null; count: PlanetCount } => ({
  limit: limitOf(ctx, research),
  count: planetCount(ctx, owner),
});

/** The refusal of a launch at the limit, with the count (#237, [V] wording of the issue). */
export function limitRefusal(
  ctx: Ctx,
  owner: string,
  research: Levels,
): string {
  const { limit, count } = colonyRoom(ctx, owner, research);
  return limitText(limit!, count, colonyRules(universe(ctx)));
}
