// Holding on the server (#55, okf/features/holding-acs.md): who is an ally of
// a player under the admin's setting of the round (Q2), the fleets that hold
// at a place, and the end of holding. The rules are in src/core/holding.ts;
// the mission is src/features/missions/hold/.
import { relationOf } from '../../core/friends.ts';
import {
  type Bond,
  holdEnd,
  holdOpen,
  homeAt,
  isAlly,
  shipsOf,
  showsHeldApart,
} from '../../core/holding.ts';
import { HOLD_REASON_TEXT, HOLD_REPORT_TITLE } from '../../core/hold-texts.ts';
import { missionRules } from '../../core/missions.ts';
import { placeName } from '../../core/moon.ts';
import type { Fleet, Levels, Planet } from '../../core/types.ts';
import type { StateShape } from '../../core/state/holding.ts';
import type { ServerFeature, StatePart } from './feature.ts';
import type { Handler } from './actions.ts';
import { type Ctx, addReport, coords, fail } from './context.ts';
import { lockEndText } from './main-planet.ts';
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

/** Whether a fleet is a Halten, by the rules of its mission (the table of the fleets allows no other). */
const holds = (f: Fleet): boolean => missionRules(f.mission)!.holds === true;

/** The fleets that hold at a place now (#55): they defend it. */
export const heldAt = (ctx: Ctx, place: string): Fleet[] =>
  ctx.fleets.at(place).filter((f) => f.state === 'hold' && holds(f));

/**
 * Whether a fleet of another player than `host` holds at a place now: there
 * the noob protection of the host lapses for attacks and espionage (#440,
 * 238c, 281b); a fleet on its way does not count yet.
 */
export const heldByOthers = (ctx: Ctx, place: string, host: string): boolean =>
  heldAt(ctx, place).some((f) => f.owner !== host);

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

/** The place of a hold as its reports name it: the planet or moon and its coordinates. */
const placeOf = (ctx: Ctx, f: Fleet): string => {
  const host = ctx.planets.get(f.to);
  return host ? `${placeName(host)} ${coords(f.toC)}` : coords(f.toC);
};

/**
 * A hold turns home at `at`, from where it is (#440): one that holds, or
 * has just arrived (4a), flies home as at the end of its holding time,
 * without the rest of it, as `sendHome`; one on its way turns back like a
 * recall (231a), as long as it has flown. The fuel of the unused hours is not
 * refunded, as after a recall.
 */
function turnHome(ctx: Ctx, f: Fleet, at: number = ctx.now()): void {
  if (f.state === 'hold' || at >= f.arr)
    turnBack(ctx, f, { ret: homeAt(f, at) });
  else turnBack(ctx, f, { ret: at + (at - f.dep), recalled: true });
}

/** An info report about a hold to `uid`, pushed under „Wachen“ (#440, 243b and 283a). */
function holdReport(
  ctx: Ctx,
  uid: string,
  at: number,
  title: string,
  text: string,
): void {
  addReport(
    ctx,
    uid,
    { time: at, type: 'info', title, text },
    { topic: 'holds' },
  );
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
  addReport(
    ctx,
    f.owner,
    {
      time: at,
      type: 'info',
      title: `Wache heimgeschickt ${coords(f.toC)}`,
      text: `Deine Wache bei ${placeOf(ctx, f)} wurde heimgeschickt: Der Gastgeber hat den Urlaubsmodus begonnen.`,
    },
    { topic: 'fleet' },
  );
}

/** Why a hold is no longer allowed (#440). */
export type HoldReason = keyof typeof HOLD_REASON_TEXT;

/** Whether a fleet is a hold that flies to its host or holds there. */
const runningHold = (f: Fleet): boolean =>
  holds(f) && (f.state === 'out' || f.state === 'hold');

/**
 * Why the hold `f` is no longer allowed, or null (#440): „Wache stellen“ is
 * off in the round (240a), the host takes no holds (282a), or the bond
 * between the owner and the host ended or „Verbündete“ changed (229a).
 * A hold whose place is gone is left to the rules of that place.
 */
export function holdError(ctx: Ctx, f: Fleet): HoldReason | null {
  const host = ctx.planets.get(f.to)?.owner;
  if (host === undefined) return null;
  if (!holdOpen(roundRules(ctx))) return 'off';
  if (ctx.holdRefusals.refuses(host)) return 'refused';
  return isAllyOf(ctx, f.owner, host) ? null : 'bond';
}

/**
 * A hold that is no longer allowed turns home at `at`, and its owner gets the
 * report „Deine Wache bei {Planet} kehrt zurück: {Grund}.“ (#440).
 */
export function endNotAllowed(
  ctx: Ctx,
  f: Fleet,
  reason: HoldReason,
  at: number = ctx.now(),
): void {
  turnHome(ctx, f, at);
  holdReport(
    ctx,
    f.owner,
    at,
    HOLD_REPORT_TITLE.notAllowed,
    `Deine Wache bei ${placeOf(ctx, f)} kehrt zurück: ${HOLD_REASON_TEXT[reason]}.`,
  );
}

/**
 * Checks every hold again, on its way or holding, and turns home those that
 * are no longer allowed (#440). Called when a friendship or a guild
 * membership changes, when the settings of the round change, at every pass
 * of the highscore, when a host switches „Keine Wachen annehmen“ on, and at
 * the start of the server (which also handles the update); no timer of its
 * own [V].
 */
export function recheckHolds(ctx: Ctx): void {
  for (const f of ctx.fleets.all().filter(runningHold)) {
    const reason = holdError(ctx, f);
    if (reason) endNotAllowed(ctx, f, reason);
  }
}

/** The host learns of a hold at its launch (#440, 242c). */
export function holdLaunched(ctx: Ctx, f: Fleet, host: string): void {
  holdReport(
    ctx,
    host,
    f.dep,
    HOLD_REPORT_TITLE.launch,
    `${playerOf(ctx, f.owner).name} schickt eine Wache zu ${placeOf(ctx, f)}. Ankunft: ${lockEndText(f.arr)}.`,
  );
}

/** The host learns of a hold at its arrival (#440, 242c). */
export function holdArrived(ctx: Ctx, f: Fleet, host: string): void {
  holdReport(
    ctx,
    host,
    f.arr,
    HOLD_REPORT_TITLE.arrival,
    `${playerOf(ctx, f.owner).name} hält mit einer Flotte Wache bei ${placeOf(ctx, f)} bis ${lockEndText(holdEnd(f))}.`,
  );
}

/**
 * „Wegschicken“ (#440, 230b and 231a): the host sends a hold away, one that
 * holds at its place or flies there to hold. It turns home at once from
 * where it is, and its owner gets the report.
 */
const sendAway: Handler<'sendAway'> = (ctx, u, d) => {
  const found = ctx.fleets.get(String(d.id));
  const f =
    found && runningHold(found) && ctx.planets.get(found.to)?.owner === u.id
      ? found
      : fail('Ungültig.');
  const t = ctx.now();
  turnHome(ctx, f, t);
  holdReport(
    ctx,
    f.owner,
    t,
    HOLD_REPORT_TITLE.sentAway,
    `${u.name} hat deine Wache bei ${placeOf(ctx, f)} weggeschickt. Deine Flotte kehrt zurück.`,
  );
  return null;
};

/**
 * „Keine Wachen annehmen“ (#440, 230b): on, a launch of a hold to the player
 * is refused, and every hold at the player or on its way there turns home at
 * once (282a).
 */
const holdOption: Handler<'holdOption'> = (ctx, u, d) => {
  ctx.holdRefusals.set(u.id, d.on === true);
  if (d.on === true) recheckHolds(ctx);
  return 'Gespeichert.';
};

export const serverFeature = {
  actions: { sendAway, holdOption },
  state: {
    // The next free ten above the highest (230).
    order: 240,
    keys: ['holdsRefused'],
    build: (ctx, u) => ({ holdsRefused: ctx.holdRefusals.refuses(u.id) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;

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
