// Holding on the server (#55, okf/features/holding-acs.md): who is an ally of
// a player under the admin's setting of the round (Q2), the fleets that hold
// at a place, and the end of holding. The rules are in src/core/holding.ts;
// the mission is src/features/missions/hold/.
import { type Bond, isAlly } from '../../core/holding.ts';
import { missionRules } from '../../core/missions.ts';
import type { Fleet } from '../../core/types.ts';
import type { Ctx } from './context.ts';
import { turnBack } from './missions.ts';
import { roundRules } from './round.ts';

/** Whether `a` and `b` are members of the same guild while guilds are on (#191). */
function sameGuild(ctx: Ctx, a: string, b: string): boolean {
  if (!roundRules(ctx).guilds) return false;
  const x = ctx.guilds.membership(a);
  const y = ctx.guilds.membership(b);
  return (
    x?.status === 'member' &&
    y?.status === 'member' &&
    x.guild_id === y.guild_id
  );
}

/**
 * Whether `a` and `b` are friends. The buddy list (#227) is not built yet,
 * so nobody is: its pull request answers this from its friendships, and the
 * setting „Freunde“ then lets them hold.
 */
export const areFriends: (ctx: Ctx, a: string, b: string) => boolean = () =>
  false;

/** What binds `a` and `b`, whatever the admin chose. */
const bondOf = (ctx: Ctx, a: string, b: string): Bond => ({
  guild: sameGuild(ctx, a, b),
  friends: areFriends(ctx, a, b),
});

/** Whether `owner` is an ally of `uid` under the setting of the round (Q2). */
export const isAllyOf = (ctx: Ctx, uid: string, owner: string): boolean =>
  isAlly(roundRules(ctx).allies, bondOf(ctx, uid, owner));

/** Whether a fleet is a Halten, by the rules of its mission. */
const holds = (f: Fleet): boolean => missionRules(f.mission)?.holds === true;

/** The fleets that hold at a place now (#55): they defend it. */
export const heldAt = (ctx: Ctx, place: string): Fleet[] =>
  ctx.fleets.at(place).filter((f) => f.state === 'hold' && holds(f));

/**
 * The owners of the fleets that hold at a place or fly there to hold, one
 * per fleet: what the limits of a planet count.
 */
export const holdersAt = (ctx: Ctx, place: string): string[] =>
  ctx.fleets
    .at(place)
    .filter(holds)
    .map((f) => f.owner);

/** The holding time is over: the fleet flies home with what it has left. */
export function endHold(ctx: Ctx, f: Fleet): void {
  turnBack(ctx, f);
}
