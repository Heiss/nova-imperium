// Holding on the server (#55, okf/features/holding-acs.md): who is an ally of
// a player under the admin's setting of the round (Q2), the fleets that hold
// at a place, and the end of holding. The rules are in src/core/holding.ts;
// the mission is src/features/missions/hold/.
import { relationOf } from '../../core/friends.ts';
import {
  type Bond,
  homeAt,
  isAlly,
  shipsOf,
  showsHeldApart,
} from '../../core/holding.ts';
import { missionRules } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import { type Ctx, addReport, coords } from './context.ts';
import { playerOf, turnBack } from './missions.ts';
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
 * Whether `a` and `b` are friends (#227): the friendship of the buddy list
 * is accepted; an open request, either way, is none.
 */
export const areFriends = (ctx: Ctx, a: string, b: string): boolean =>
  relationOf(ctx.friends.links(a), a, b) === 'friends';

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

/**
 * A fleet that holds, or arrives to hold, flies home at once (owner,
 * 2026-11-19: the host starts the vacation mode): the same flight home as at
 * the end of its holding time, without the rest of it. The fuel of the
 * unused hours is not refunded, as after a recall. Its owner gets one info
 * report [V] (owner, 2026-11-19: both at the start of the vacation and at
 * the arrival at a host in vacation).
 */
export function sendHome(ctx: Ctx, f: Fleet, at: number = ctx.now()): void {
  turnBack(ctx, f, { ret: homeAt(f, at) });
  const host = ctx.planets.get(f.to);
  const where = host ? `${placeName(host)} ${coords(f.toC)}` : coords(f.toC);
  addReport(
    ctx,
    f.owner,
    {
      time: at,
      type: 'info',
      title: `Wache heimgeschickt ${coords(f.toC)}`,
      text: `Deine Wache bei ${where} wurde heimgeschickt: Der Gastgeber hat den Urlaubsmodus begonnen.`,
    },
    { topic: 'fleet' },
  );
}

/** A fleet that holds at the target as a spy report shows it apart. */
interface HeldFleet {
  name: string;
  ships: Levels;
}

/**
 * The parts `shown` of a spy report with the fleets that hold at the target
 * (owner, 2026-11-17), when the report shows the fleet: below the round's
 * level of the spy's Auspex-Lehre `spy` they count into the planet's fleet,
 * from it on they show apart under „Gehaltene Flotten“.
 */
export function withHeldFleets(
  ctx: Ctx,
  t: Planet,
  spy: number,
  shown: Record<string, unknown>,
): Record<string, unknown> {
  const held = heldAt(ctx, t.id);
  if (!held.length || !shown.ships) return shown;
  if (!showsHeldApart(spy, roundRules(ctx).heldSpy))
    return { ...shown, ships: shipsOf([t, ...held]) };
  const apart: HeldFleet[] = held.map((h) => ({
    name: playerOf(ctx, h.owner).name,
    ships: h.ships,
  }));
  return { ...shown, held: apart };
}
