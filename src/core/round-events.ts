// The events of a running round (#235): the kinds the server writes into the
// history of the round while it runs, and the shapes of their payloads, so the
// Rewind and the curves read them on one contract. Written by
// src/server/game/round-events.ts; the facts of the close (`player.final`,
// `guild.final`, `round.closed`) are in round-report.ts. An event names a
// player only by its seat (the pseudonym applies after a deletion); a payload
// holds ids and numbers, no names. Resource amounts are whole numbers.
import { UNIT } from './catalog.ts';
import type { Cost, Levels, ResearchState, Resources } from './types.ts';

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
  /** A research that finished, at its logical end (version 2). */
  research: 'research.done',
  /** A colony or a moon that came into being (version 2). */
  created: 'place.created',
  /** A colony or a moon that is gone (version 2). */
  removed: 'place.removed',
  /** What the places and the research produced up to the cutoff, written by the close (version 2). */
  close: 'journal.close',
} as const;

/**
 * The schema version of the payloads below (`round_events.version`). Version
 * 2 (the update after 2026-11-22) adds the events `research.done`,
 * `place.created`, `place.removed` and `journal.close`, `unitsCost` and `back`
 * in `Produced`, and `gift` in `JournalFleet`. A round that holds an event of
 * version 1 began before them: what needs them is unknown there, not zero.
 */
export const EVENT_VERSION = 2;

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
  /**
   * The building that finished: its key, level, logical end and what it had
   * cost. `back` (version 2) is there on a demolition: what its end gave back.
   * The level of a demolition is the one that stands afterwards.
   */
  built?: {
    key: string;
    lvl: number;
    end: number;
    cost: readonly number[];
    back?: readonly number[];
  };
  /** The units the shipyard finished, by key. */
  units?: Levels;
  /**
   * What the finished units had cost (version 2): the catalog cost times the
   * number, ships and defense apart. Only on an entry with units.
   */
  unitsCost?: { ships?: Cost; def?: Cost };
}

/** The raw cost of the units of `units`, as the shipyard charged it, by the key of the catalog. */
export function unitsCost(units: Levels): Cost {
  const sum: [number, number, number] = [0, 0, 0];
  for (const [key, n] of Object.entries(units)) {
    const def = UNIT[key];
    if (def) for (const i of [0, 1, 2] as const) sum[i] += def.cost[i] * n;
  }
  return sum;
}

/** The cost of finished units, ships and defense apart; undefined for none of them. */
export function unitsPaid(
  ships: Levels,
  def: Levels,
): Produced['unitsCost'] | undefined {
  const out: NonNullable<Produced['unitsCost']> = {};
  if (Object.keys(ships).length) out.ships = unitsCost(ships);
  if (Object.keys(def).length) out.def = unitsCost(def);
  return Object.keys(out).length ? out : undefined;
}

/** The payload of `research.done` (seat set): the research that finished, at its logical end. */
export interface ResearchDone {
  key: string;
  lvl: number;
  end: number;
  /** What its start had paid. */
  cost: readonly number[];
  /** What caused the save that noticed it. */
  cause: string;
}

/**
 * The research that finished between the stored state `prev` and the saved
 * state `next` of a player, or null. It finished when it was due at `now` and
 * the saved research holds its level; a research that the save cancelled, or
 * that a gift overtook before its end, did not.
 */
export function researchFinished(
  prev: ResearchState,
  next: Pick<ResearchState, 'research'>,
  now: number,
): Omit<ResearchDone, 'cause'> | null {
  const q = prev.rq;
  if (!q || q.end > now || (next.research[q.key] ?? 0) < q.lvl) return null;
  return { key: q.key, lvl: q.lvl, end: q.end, cost: q.cost };
}

/** The payload of `place.created` and `place.removed` (seat of the owner): which place, and what caused it. */
export interface PlaceChanged {
  place: string;
  kind: 'planet' | 'moon';
  g: number;
  s: number;
  p: number;
  cause: string;
}

/** The payload of `journal.close`: what the close settled up to the cutoff. */
export interface JournalClose {
  cause: 'close';
  prod?: Produced[];
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
  /** The arrival of the gift of the Endzeit (version 2): an admin gift, no production and no investment. */
  gift?: true;
}
