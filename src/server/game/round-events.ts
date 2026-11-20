// The writing side of the events of a running round (#235, owner 2026-11-20:
// from the update of 2026-11-22 the events of a round are written as round
// events). Every event is written in the transaction of the change it records
// and changes nothing in the game: a round that is not active (closed, or
// without a row) takes no event, and a read writes nothing. The kinds and the
// payloads are in src/core/round-events.ts. This file depends on the context
// and the repositories only, so the places that change the game can call it.
import {
  type BaselinePlace,
  EVENT_KIND,
  EVENT_VERSION,
  type ParticipantJoined,
  whole,
} from '../../core/round-events.ts';
import type { Levels, Planet } from '../../core/types.ts';
import type { Ctx } from './context.ts';

/** The levels above 0: what stood there. */
const standing = (levels: Levels): Levels =>
  Object.fromEntries(Object.entries(levels).filter(([, n]) => n > 0));

/** The number of the running round if it is active, else null: a round without an active row writes nothing. */
function activeRound(ctx: Ctx): number | null {
  const number = ctx.admin.setting('round') ?? 1;
  return ctx.rounds.isActive(number) ? number : null;
}

/**
 * Writes one event of the running round at the logical time `at` (when the
 * fact took effect; the time of writing is now). Nothing happens in a round
 * that is not active.
 */
export function writeRoundEvent(
  ctx: Ctx,
  kind: string,
  seat: number | null,
  payload: object,
  at: number = ctx.now(),
): void {
  const round = activeRound(ctx);
  if (round === null) return;
  ctx.rounds.addEvent(round, ctx.now(), {
    at,
    kind,
    seat,
    version: EVENT_VERSION,
    payload,
  });
}

const baselineOf = (p: Planet): BaselinePlace => ({
  kind: p.kind,
  g: p.g,
  s: p.s,
  p: p.p,
  res: whole(p.res),
  b: standing(p.b),
  ships: standing(p.ships),
  def: standing(p.def),
});

/**
 * Gives an account its seat in the running round and writes `participant.joined`
 * with the baseline, once; an account that has a seat keeps it. `places` are
 * the places of the baseline: a new home planet as it was placed, or, for a
 * player already playing, the stored state (the raw rows: what has finished
 * but is not yet saved is written as its own event when it is saved, so the
 * baseline and the later events add up). Returns null in a round that is not
 * active.
 */
export function joinRound(
  ctx: Ctx,
  userId: string,
  entry: ParticipantJoined['entry'],
  places: readonly Planet[] = ctx.planets.ofOwner(userId),
): number | null {
  const round = activeRound(ctx);
  if (round === null) return null;
  const known = ctx.rounds.seatOf(round, userId);
  if (known !== null) return known;
  const user = ctx.players.get(userId);
  // An account that holds no place (an admin without a planet) is no participant.
  if (!user || !places.length) return null;
  const seat = ctx.rounds.nextSeat(round);
  ctx.rounds.addParticipant({ round, seat, player: userId, name: user.name });
  writeRoundEvent(ctx, EVENT_KIND.joined, seat, {
    entry,
    places: places.map(baselineOf),
    research: entry === 'home' ? {} : standing(user.research),
  } satisfies ParticipantJoined);
  return seat;
}

/**
 * The seat of an account in the running round. A player who was playing when
 * the history began has none yet: they join now, as `present`, with the state
 * the server knows (nothing before is invented). Null in a round that is not
 * active and for an account that does not exist.
 */
export function seatOf(ctx: Ctx, userId: string): number | null {
  const round = activeRound(ctx);
  if (round === null) return null;
  return ctx.rounds.seatOf(round, userId) ?? joinRound(ctx, userId, 'present');
}
