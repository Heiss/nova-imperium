// The reader of the Runden-Rewind (#235, view G, owner 2026-11-21): the values
// of the cards 2 (production), 3 (investment mix), 4 (largest loss), 5
// (recovery) and 7 (Endzeit) derived on read from the ordered events of one
// round. Pure rules, nothing is stored (owner, 2026-11-16). Every function
// answers null when the events do not hold the fact: no fact, no card (issue,
// view G: „no combat means skip the battle card“).
//
// What the events hold (src/core/round-events.ts, version 2):
//  - production: `prod` of `journal.action`, `journal.arrival`, `journal.hold`,
//    `journal.return` and `journal.close`, entries of the seat as `owner`;
//  - investment: `prod[].built` (a finished building), `research.done`,
//    `prod[].unitsCost` (finished ships and defense);
//  - battles: the numbers of `battle` of a fleet event, once per battle;
//  - the Endzeit: the action `endzeit` and the arrival with `gift`.
// A round that holds an event of version 1, a seat that joined in mid-round
// (`entry` `present`) or no events at all has no such cards: what it lacks is
// unknown there, not zero (`completeFor`).
import { SHIPS } from './catalog.ts';
import {
  ENDZEIT_EVENT,
  EVENT_KIND,
  type JournalBattle,
  type Produced,
  unitsCost,
} from './round-events.ts';
import { pointsOf } from './points.ts';
import { resourceSum } from './round-report.ts';
import type { Levels, Resources } from './types.ts';

const DAY = 86_400_000;

/** One event of the round as the reader gets it, in the order the round wrote it. */
export interface RewindEvent {
  at: number;
  kind: string;
  seat: number | null;
  version: number;
  payload: Record<string, unknown>;
}

/** The kinds of the journal: the events that carry the version of the journal. */
const JOURNAL: ReadonlySet<string> = new Set(Object.values(EVENT_KIND));

/** The first version that holds everything the cards 2, 3, 5 and 7 read. */
const FIRST_COMPLETE_VERSION = 2;

/** The events in the order of their logical time; equal times keep the order they were written in. */
const inOrder = (events: readonly RewindEvent[]): RewindEvent[] =>
  [...events].sort((a, b) => a.at - b.at);

/**
 * Whether the cards that sum up the whole round may be built for `seat`: the
 * round holds events and none of version 1, and the seat joined with a new
 * home planet (`participant.joined`, `entry` `home`), so nothing of its way
 * lies before the history. A seat that joined as `present` or has no joining
 * event lacks its early history.
 */
export function completeFor(
  events: readonly RewindEvent[],
  seat: number,
): boolean {
  // The facts of the close and the annotations of the admin have their own version.
  const journal = events.filter((e) => JOURNAL.has(e.kind));
  if (
    !journal.length ||
    journal.some((e) => e.version < FIRST_COMPLETE_VERSION)
  )
    return false;
  return journal.some(
    (e) =>
      e.kind === EVENT_KIND.joined &&
      e.seat === seat &&
      e.payload.entry === 'home',
  );
}

const cost = (v: readonly number[] | undefined): number =>
  (v ?? []).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);

/** The `prod` entries of the seat in one event: only places the seat owned. */
const prodOf = (e: RewindEvent, seat: number): Produced[] => {
  const list = e.payload.prod;
  return Array.isArray(list)
    ? (list as Produced[]).filter((p) => p.owner === seat)
    : [];
};

/** The construction value of ships or defense: the raw cost of each unit times its number. */
export const constructionValue = (units: Levels): number =>
  cost(unitsCost(units));

/** Only the ships of a mixed set of units (a battle's defender holds defense too). */
const shipsOf = (units: Levels | undefined): Levels =>
  Object.fromEntries(
    Object.entries(units ?? {}).filter(([key]) => key in SHIPS),
  );

/** What the units of `before` lost in the battle, by key: the units that are fewer afterwards. */
function lost(before: Levels, after: Levels | undefined): Levels {
  const out: Levels = {};
  for (const [key, n] of Object.entries(before)) {
    const left = Math.min(n, after?.[key] ?? 0);
    if (n > left) out[key] = n - left;
  }
  return out;
}

/** Card 2: the resources the game credited to the places of the seat, a demolition's refund taken out. */
export interface Production extends Resources {
  /** The sum of the three resources (an unweighted sum, not a value). */
  total: number;
}

export function productionOf(
  events: readonly RewindEvent[],
  seat: number,
): Production | null {
  if (!completeFor(events, seat)) return null;
  const sum = { m: 0, c: 0, d: 0 };
  for (const e of events)
    for (const p of prodOf(e, seat)) {
      // The refund of a demolition is in the credit; it is no production.
      const back = p.built?.back ?? [];
      sum.m += p.m - (back[0] ?? 0);
      sum.c += p.c - (back[1] ?? 0);
      sum.d += p.d - (back[2] ?? 0);
    }
  const r = {
    m: Math.round(sum.m),
    c: Math.round(sum.c),
    d: Math.round(sum.d),
  };
  const total = resourceSum(r);
  return total > 0 ? { ...r, total } : null;
}

/** The categories the investment is told in: those of the highscore (#78). */
export const INVESTMENT = [
  'buildings',
  'research',
  'fleet',
  'defense',
] as const;
export type Investment = (typeof INVESTMENT)[number];

/** What one event paid in one category: the sum of the three resources. */
function paidIn(e: RewindEvent, seat: number, kind: Investment): number {
  if (kind === 'research')
    return e.kind === EVENT_KIND.research && e.seat === seat
      ? cost(e.payload.cost as number[] | undefined)
      : 0;
  return prodOf(e, seat).reduce((sum, p) => {
    if (kind === 'buildings')
      return sum + (p.built && !p.built.back ? cost(p.built.cost) : 0);
    return sum + cost(kind === 'fleet' ? p.unitsCost?.ships : p.unitsCost?.def);
  }, 0);
}

/**
 * What the seat paid for what finished, by category: the cost of the finished
 * buildings (no demolition), the finished research, the finished ships and the
 * finished defense, each as the sum of the three resources.
 */
export function investmentOf(
  events: readonly RewindEvent[],
  seat: number,
): Record<Investment, number> | null {
  if (!completeFor(events, seat)) return null;
  const spent = { buildings: 0, research: 0, fleet: 0, defense: 0 };
  for (const e of events)
    for (const k of INVESTMENT) spent[k] += paidIn(e, seat, k);
  return spent;
}

/** Card 3: the category with the largest share of what was paid, and that share in whole percent. */
export interface Focus {
  focus: Investment;
  percent: number;
}

/**
 * The focus of an investment mix, or null when nothing was paid or when the
 * largest share is held by two categories: then the facts name no single
 * focus (the rule of the issue: no fact, no card).
 */
export function focusOf(spent: Record<Investment, number>): Focus | null {
  const all = INVESTMENT.reduce((s, k) => s + spent[k], 0);
  if (all <= 0) return null;
  const ranked = [...INVESTMENT].sort((a, b) => spent[b] - spent[a]);
  const top = ranked[0]!;
  if (spent[top] <= 0 || spent[ranked[1]!] === spent[top]) return null;
  return { focus: top, percent: Math.round((spent[top] / all) * 100) };
}

/** Card 4: the battle with the largest own loss of ship construction value. */
export interface Loss {
  /** The logical time of the battle. */
  at: number;
  /** The own loss in Flottenpunkte: the construction value of the lost ships divided by 1000, rounded down. */
  points: number;
  /** The construction value of the lost ships, undivided. */
  value: number;
  role: 'attacker' | 'defender';
  /** The seat of the other side; null when the events do not name one. */
  opponent: number | null;
}

function battleOf(e: RewindEvent): JournalBattle | null {
  const b = e.payload.battle;
  return b && typeof b === 'object' ? (b as JournalBattle) : null;
}

const isFleetEvent = (e: RewindEvent): boolean =>
  e.kind === EVENT_KIND.arrival ||
  e.kind === EVENT_KIND.hold ||
  e.kind === EVENT_KIND.return;

/** The ships the seat lost in one event, or null when the seat took no part in a battle of it. */
function shipsLost(e: RewindEvent, seat: number): Levels | null {
  const b = isFleetEvent(e) ? battleOf(e) : null;
  if (!b) return null;
  if (e.seat === seat && b.attBefore)
    return lost(shipsOf(b.attBefore), b.attAfter);
  if (e.payload.target === seat && b.defBefore)
    return lost(shipsOf(b.defBefore), b.defAfter);
  return null;
}

/** The loss of the seat in one event, or null when the seat lost no ship in it. */
function lossIn(e: RewindEvent, seat: number): Loss | null {
  const gone = shipsLost(e, seat);
  const value = gone ? constructionValue(gone) : 0;
  if (value <= 0) return null;
  const attacker = e.seat === seat;
  const other = attacker ? e.payload.target : e.seat;
  return {
    at: e.at,
    points: pointsOf(value),
    value,
    role: attacker ? 'attacker' : 'defender',
    opponent: typeof other === 'number' ? other : null,
  };
}

/**
 * The single battle with the largest own loss of ship construction value,
 * attacker or defender, without a threshold; the defense that fell does not
 * count. The earliest of equal losses wins. Null when the seat lost no ship
 * in a recorded battle. Needs battle numbers only, which version 1 holds too;
 * a round that began before the history may hold more losses than it shows.
 */
export function largestLoss(
  events: readonly RewindEvent[],
  seat: number,
): Loss | null {
  let best: Loss | null = null;
  for (const e of inOrder(events)) {
    const here = lossIn(e, seat);
    if (here && here.value > (best?.value ?? 0)) best = here;
  }
  return best;
}

/**
 * Card 5: the days from the loss to the first event at which the construction
 * value of the own ships was back at its level before the loss.
 */
export interface Recovery {
  /** Whole days, at least 1 (the length of a round counts the same way). */
  days: number;
  /** The logical time of that event. */
  at: number;
}

/** The ships a place of the baseline held. */
const baseline = (e: RewindEvent): number => {
  const places = e.payload.places;
  return Array.isArray(places)
    ? places.reduce(
        (s: number, p: { ships?: Levels }) =>
          s + constructionValue(shipsOf(p.ships)),
        0,
      )
    : 0;
};

/** The arrival of the gift fleet of the Endzeit for the seat. */
const isGift = (e: RewindEvent, seat: number): boolean =>
  isFleetEvent(e) && e.seat === seat && e.payload.gift === true;

/** The change of the fleet value an event brings for the seat, before its losses. */
function gained(e: RewindEvent, seat: number): number {
  let sum = 0;
  if (e.kind === EVENT_KIND.joined && e.seat === seat) sum += baseline(e);
  for (const p of prodOf(e, seat)) sum += cost(p.unitsCost?.ships);
  // The gift of the Endzeit lands as ships of the seat.
  if (isGift(e, seat))
    sum += constructionValue(shipsOf(e.payload.ships as Levels | undefined));
  return sum;
}

/** What one event does to the fleet value of the seat. */
interface Step {
  at: number;
  gained: number;
  lost: number;
  /** The event is the arrival of the gift of the Endzeit. */
  gift: boolean;
}

const steps = (events: readonly RewindEvent[], seat: number): Step[] =>
  inOrder(events).map((e) => {
    const gone = shipsLost(e, seat);
    return {
      at: e.at,
      gained: gained(e, seat),
      lost: gone ? constructionValue(gone) : 0,
      gift: isGift(e, seat),
    };
  });

/**
 * When the fleet value of the seat was back at its level before `loss`, or
 * null. The fleet value is the construction value of the own ships: the ships
 * the places finished (`unitsCost.ships`), the ships of the baseline, minus the
 * ships lost in the recorded battles, and plus the ships of the Endzeit gift
 * (an own fleet from its landing). Null when
 *  - the round or the seat is not complete (`completeFor`),
 *  - the value before the loss is smaller than the loss (the events then miss
 *    ships, so the level is not known),
 *  - the value never came back, or
 *  - the gift of the Endzeit arrived between the loss and the recovery: a
 *    recovery that the admin's gift could have caused is not told as one.
 * The events before and at the same time as the loss count in the order they
 * were written; the production of the event of the loss counts before the loss.
 */
export function recoveryOf(
  events: readonly RewindEvent[],
  seat: number,
  loss: Loss,
): Recovery | null {
  if (!completeFor(events, seat)) return null;
  const list = steps(events, seat);
  const index = list.findIndex(
    (s) => s.at === loss.at && s.lost === loss.value,
  );
  if (index < 0) return null;
  // The level before the loss: everything up to and including the production of its event.
  const level = list
    .slice(0, index + 1)
    .reduce((v, s, i) => v + s.gained - (i < index ? s.lost : 0), 0);
  if (level < loss.value) return null;
  let value = level - loss.value;
  let gift = false;
  for (const s of list.slice(index + 1)) {
    value += s.gained - s.lost;
    gift ||= s.gift;
    if (value >= level)
      return gift
        ? null
        : { days: Math.max(1, Math.ceil((s.at - loss.at) / DAY)), at: s.at };
  }
  return null;
}

/** Card 7: the Endzeit and what the admin's gift brought to the seat, apart from the own play. */
export interface Endzeit {
  /** The logical time the Endzeit was rung in. */
  at: number;
  /** The gift that landed at the seat; null when none of it arrived in the round. */
  gift: { ships: number; cargo: Resources } | null;
}

const count = (units: Levels): number =>
  Object.values(units).reduce((s, n) => s + n, 0);

/**
 * The Endzeit of the round: the time of the event that rang it in (written
 * only by a ring-in that went through), and the arrival of the gift fleet of the seat. Null
 * when no Endzeit was rung in during the round. The gift is no production and
 * no investment: the cards 2, 3 and 5 do not read it as such (its cargo is no
 * `prod`, its ships are no `unitsCost`).
 */
export function endzeitOf(
  events: readonly RewindEvent[],
  seat: number,
): Endzeit | null {
  if (!completeFor(events, seat)) return null;
  const ring = inOrder(events).find((e) => e.kind === ENDZEIT_EVENT);
  if (!ring) return null;
  const arrival = events.find(
    (e) =>
      e.kind === EVENT_KIND.arrival &&
      e.seat === seat &&
      e.payload.gift === true,
  );
  return {
    at: ring.at,
    gift: arrival
      ? {
          ships: count(arrival.payload.ships as Levels),
          cargo: arrival.payload.cargo as Resources,
        }
      : null,
  };
}
