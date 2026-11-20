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
  /** One game action of a player (the journal, #235): the cause, the input, the outcome. */
  action: 'journal.action',
  /** One fleet arrival at its target. */
  arrival: 'journal.arrival',
  /** The end of a Halten: the fleet flies home. */
  hold: 'journal.hold',
  /** One fleet back home. */
  return: 'journal.return',
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

/**
 * What the settlement of one place produced between two saves, derived when
 * the place is saved (src/server/game/journal.ts): the change of the stock
 * from `from` to `to` as the game credited it (after the storage limits and
 * after the use of an entry that consumes), `f` the energy factor of the
 * mines at `from`, and what finished in between at its logical time.
 */
export interface Produced {
  /** The place id, e.g. `p1_2_3` or `m1_2_3`. */
  place: string;
  /** The seat of the owner. */
  owner: number | null;
  from: number;
  to: number;
  /** The stock credited, two decimals; the refund of a demolition is in it. */
  m: number;
  c: number;
  d: number;
  f: number;
  /** The building that finished: its key, level, logical end and what it had cost. */
  built?: { key: string; lvl: number; end: number; cost: readonly number[] };
  /** The units the shipyard finished, by key. */
  units?: Levels;
}

/** A report written while the cause ran: its id, the kind and the seat it went to. */
export interface JournalReport {
  id: string;
  type: string;
  to: number | null;
}

/** The result of a battle, copied once from its report: numbers only, no names. */
export interface JournalBattle {
  rounds?: number;
  winner?: string;
  attBefore?: Levels;
  attAfter?: Levels;
  defBefore?: Levels;
  defAfter?: Levels;
  rebuilt?: Levels;
  loot?: Resources;
  debris?: Resources;
}

/** The parts every journal event shares. */
interface JournalBase {
  /** What caused it: the action name, or `arrival`, `hold`, `return`. */
  cause: string;
  /** What the settlement of the places touched produced; missing when nothing. */
  prod?: Produced[];
  /** The reports written; missing when none. */
  reports?: JournalReport[];
}

/** The payload of `journal.action`: the seat is the actor; a refused action has `ok` false and its message. */
export interface JournalAction extends JournalBase {
  input: Record<string, unknown>;
  ok: boolean;
  /** The refusal as the player saw it, without any text they typed. */
  msg?: string;
}

/** The payload of `journal.arrival`, `journal.hold` and `journal.return`: the seat is the owner of the fleet. */
export interface JournalFleet extends JournalBase {
  mission: string;
  fleet: string;
  from: string;
  to: string;
  /** The seat of the owner of the target place at that moment. */
  target: number | null;
  ships: Levels;
  cargo: Resources;
  /** What became of the fleet: gone, on its way back, holding, or still out. */
  fate: 'gone' | 'back' | 'hold' | 'out';
  battle?: JournalBattle;
}
