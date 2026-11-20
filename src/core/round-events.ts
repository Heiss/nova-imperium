// The events of a running round (#235): the kinds the server writes into the
// history of the round while it runs, and the shapes of their payloads, so the
// Rewind and the curves read them on one contract. Written by
// src/server/game/round-events.ts; the facts of the close (`player.final`,
// `guild.final`, `round.closed`) are in round-report.ts. An event names a
// player only by its seat (the pseudonym applies after a deletion); a payload
// holds ids and numbers, no names. Resource amounts are whole numbers.
import type { Levels, Resources } from './types.ts';

/** The kinds of the events written while the round runs. */
export const EVENT_KIND = {
  /** A player's first place in the round: the seat and the baseline. */
  joined: 'participant.joined',
} as const;

/** The schema version of the payloads below (`round_events.version`). */
export const EVENT_VERSION = 1;

/** A resource vector rounded down to whole numbers, so a payload stays compact. */
export const whole = (r: Resources): Resources => ({
  m: Math.floor(r.m),
  c: Math.floor(r.c),
  d: Math.floor(r.d),
});

/** What stood on one place when a player was first recorded. */
export interface BaselinePlace {
  kind: 'planet' | 'moon';
  g: number;
  s: number;
  p: number;
  res: Resources;
  /** Only what stood there: levels of buildings, ships and defense above 0. */
  b: Levels;
  ships: Levels;
  def: Levels;
}

/**
 * The payload of `participant.joined` (seat set): the first place of a
 * player in the round and the baseline of their state.
 *
 * `entry` is `home` when the player got a new home planet in this round
 * (the registration, or „Neue Runde“): the baseline is that planet as it was
 * placed, the round-time axis of the player starts here. `present` is a
 * player who was already playing when the event history began (the update of
 * 2026-11-22, mid-round): the baseline is the state the server knew at the
 * first event it wrote for them, and everything before is missing, nothing is
 * invented backwards (issue #235, section 2).
 */
export interface ParticipantJoined {
  entry: 'home' | 'present';
  places: BaselinePlace[];
  /** The researched levels; empty for a new home planet. */
  research: Levels;
}
