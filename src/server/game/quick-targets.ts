// What the Schnellwahl of the fleet form lists besides the own places (#292,
// okf/features/fleet-cargo.md): the main planet of each friend and of each
// guild member, and the last hostile targets. The state carries the ids of
// the places only; the browser words them from the galaxy and the players.
import type { User } from '../db/repos/players.ts';
import type { Ctx } from './context.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { StateShape } from '../../core/state/quick-targets.ts';
import { mainPlanetOf } from './main-planet.ts';
import type { RoundRules } from '../../core/round.ts';

/** How many last hostile targets the list shows (owner, 2026-11-17). */
const LAST_SHOWN = 5;

/** The ids of the main planets of some players, in the order given; a player without a planet is left out. */
const mains = (ctx: Ctx, ids: readonly string[], round: RoundRules): string[] =>
  ids.flatMap((id) => {
    const player = ctx.players.get(id);
    const planet = player ? mainPlanetOf(ctx, player, round).planet : null;
    return planet ? [planet.id] : [];
  });

/** The names sort the entries like the lists of the buddy list and the guild do. */
const byName = (ctx: Ctx, ids: readonly string[]): string[] => {
  const names = new Map(ctx.players.all().map((p) => [p.id, p.name]));
  return [...ids].sort((a, b) =>
    (names.get(a) ?? '').localeCompare(names.get(b) ?? '', 'de'),
  );
};

/** The friends of a player (#227), by name. */
const friendIds = (ctx: Ctx, uid: string): string[] =>
  byName(
    ctx,
    ctx.friends
      .links(uid)
      .filter((l) => l.status === 'friend')
      .map((l) => (l.from === uid ? l.to : l.from)),
  );

/**
 * The other members of the player's guild, by name; none while guilds are
 * off in the round (owner, 2026-11-17).
 */
function guildIds(ctx: Ctx, uid: string, guildsOn: boolean): string[] {
  const own = guildsOn ? ctx.guilds.membership(uid) : undefined;
  if (own?.status !== 'member') return [];
  return byName(
    ctx,
    ctx.guilds
      .players()
      .filter(
        (m) =>
          m.guild_id === own.guild_id && m.status === 'member' && m.id !== uid,
      )
      .map((m) => m.id),
  );
}

/**
 * The last hostile targets, newest first: only a place that still exists
 * with the owner it had when it was aimed at, never an own planet and never
 * a place of a player in vacation mode (owner, 2026-11-17). A target that
 * drops out is replaced by the next older one until there are five.
 */
function lastIds(ctx: Ctx, uid: string): string[] {
  const found: string[] = [];
  for (const t of ctx.targets.of(uid)) {
    if (found.length === LAST_SHOWN) break;
    const place = ctx.planets.get(t.place);
    const owner = ctx.players.get(t.owner);
    if (place?.owner === t.owner && t.owner !== uid && owner?.vacation === null)
      found.push(place.id);
  }
  return found;
}

/** The three lists of the Schnellwahl for a player: place ids. */
export function quickState(
  ctx: Ctx,
  u: User,
  round: RoundRules,
): { friends: string[]; guild: string[]; last: string[] } {
  const friends = friendIds(ctx, u.id);
  // A friend who is a guild member too is listed once, as a friend (owner, 2026-11-17).
  const guild = guildIds(ctx, u.id, round.guilds).filter(
    (id) => !friends.includes(id),
  );
  return {
    friends: mains(ctx, friends, round),
    guild: mains(ctx, guild, round),
    last: lastIds(ctx, u.id),
  };
}

export const serverFeature = {
  state: {
    order: 200,
    keys: ['quick'],
    build: (ctx, u, view) => ({ quick: quickState(ctx, u, view.round) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
