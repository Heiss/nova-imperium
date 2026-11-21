// The thin Runden-Rewind (#235, view G) as pure rules: the facts of the story
// cards of one participant of a finished round, derived on read from the report
// of the archive (`RoundReport`). Nothing is stored (owner, 2026-11-16: no
// stored statistics); a card exists only when the facts it needs exist, so a
// round with a sparse history gets a shorter, honest Rewind (issue, view G:
// „no invented top 1 %, personality type or causal strategy label“). The words
// of the cards are in src/client/logic/round-rewind.ts; the server answers with
// these facts (src/server/game/round-report.ts, action `roundRewind`).
//
// Owner, 2026-11-20: the thin update had the cards 1 (identity), 6 (play time)
// and 8 (final place). Owner, 2026-11-21: the cards 2 (production), 3
// (investment mix), 4 (largest loss), 5 (recovery) and 7 (Endzeit) are derived
// on read from the events of the round (round-rewind-facts.ts); each is one
// entry of `CARDS` below (its own slot number of the issue's table, a
// `RewindCard` variant, a builder that returns null while its events are
// missing), so the order of the story stays the order of the slots. A round
// with events of version 1 keeps the shorter form: the cards that need version
// 2 are left out.
import {
  type RoundCoverage,
  type RoundReport,
  rankRows,
  standingOf,
} from './round-report.ts';
import {
  endzeitOf,
  focusOf,
  type Focus,
  hasOldVersion,
  investmentOf,
  largestLoss,
  type Loss,
  productionOf,
  recoveryOf,
  type RewindEvent,
} from './round-rewind-facts.ts';
import type { Resources } from './types.ts';

const DAY = 86_400_000;

/** Card 1: round identity and participation. `slot` is the number of the card in the issue's table of view G. */
export interface IdentityCard {
  kind: 'identity';
  slot: 1;
  number: number;
  started: number;
  closed: number;
  days: number;
  participants: number;
  coverage: RoundCoverage;
}

/** Card 6: the estimated active time of the reader in the round (the method is named by the text). */
export interface PlaytimeCard {
  kind: 'playtime';
  slot: 6;
  /** The estimated active time in milliseconds, each real second once. */
  ms: number;
  /** The round began before the play time was measured: the time before is missing. */
  partial: boolean;
}

/** Card 8: the actual final place and the way to the full report. */
export interface RankCard {
  kind: 'rank';
  slot: 8;
  /** The round of the full report that the card links to. */
  number: number;
  rank: number;
  of: number;
  points: number;
  /** Another participant ended with the same total points; the order of equal points is the order of the seats. */
  tied: boolean;
  /** The first of the ranking; the name is the pseudonym of a deleted account (D4). */
  winner: { name: string; points: number; you: boolean };
}

/** Card 2: the resources the game credited to the places of the reader (the sum, and by resource). */
export interface EconomyCard extends Resources {
  kind: 'economy';
  slot: 2;
  total: number;
}

/** Card 3: the category with the largest share of what the reader paid for what finished. */
export interface FocusCard extends Focus {
  kind: 'focus';
  slot: 3;
}

/** Card 4: the battle with the largest own loss of ship construction value. */
export interface LossCard {
  kind: 'loss';
  slot: 4;
  /** The day of the round (1 is the first day). */
  day: number;
  /** The loss in Flottenpunkte: the construction value of the lost ships divided by 1000. */
  points: number;
  role: 'attacker' | 'defender';
  /** The other side; the pseudonym of a deleted account (D4); null when the events name none. */
  opponent: string | null;
  /**
   * The round holds events of version 1: the loss is the largest of the
   * recorded part of the round, a round that began before the history may
   * hold a larger one (owner, 2026-11-21, Q19 [V]).
   */
  recordedOnly: boolean;
}

/** Card 5: the days until the fleet value was back at its level before the card-4 loss. */
export interface ReturnCard {
  kind: 'return';
  slot: 5;
  days: number;
  /** The day of the round of the loss. */
  lossDay: number;
}

/** Card 7: the day of the Endzeit and the gift of the admin, told apart from the own play. */
export interface EndzeitCard {
  kind: 'endzeit';
  slot: 7;
  day: number;
  gift: { ships: number; cargo: Resources } | null;
}

export type RewindCard =
  | IdentityCard
  | EconomyCard
  | FocusCard
  | LossCard
  | ReturnCard
  | PlaytimeCard
  | EndzeitCard
  | RankCard;

/** The Rewind of one participant: the cards in the order of the slots. */
export interface Rewind {
  round: number;
  cards: RewindCard[];
}

/** What a builder reads: the finished report, the ranked rows and the seat of the reader. */
interface Facts {
  report: RoundReport;
  seat: number;
  ranked: ReturnType<typeof rankRows>;
  /** The events of the round in the order they were written; empty when none are given. */
  events: readonly RewindEvent[];
}

/** The day of the round a time falls on: 1 is the first day, at most the length of the round. */
const dayOf = (report: RoundReport, at: number): number =>
  Math.min(
    report.round.days,
    Math.max(1, Math.floor((at - report.round.started) / DAY) + 1),
  );

/** A card of the story: its facts, or null when the events it needs are missing. */
type Builder = (f: Facts) => RewindCard | null;

const identity: Builder = ({ report, ranked }) => ({
  kind: 'identity',
  slot: 1,
  number: report.round.number,
  started: report.round.started,
  // A finished round has its cutoff.
  closed: report.round.closed ?? report.round.asOf,
  days: report.round.days,
  participants: ranked.length,
  coverage: report.round.coverage,
});

const playtime: Builder = ({ report, seat }) => {
  const ms = report.playtime?.[seat];
  // No play time archived for the round or none for this seat: unknown, not zero.
  if (ms === undefined) return null;
  return {
    kind: 'playtime',
    slot: 6,
    ms,
    partial: report.round.coverage === 'partial',
  };
};

const rank: Builder = ({ report, seat, ranked }) => {
  const standing = standingOf(ranked, seat);
  const top = ranked[0];
  if (!standing || !top) return null;
  return {
    kind: 'rank',
    slot: 8,
    number: report.round.number,
    rank: standing.rank,
    of: standing.of,
    points: standing.points,
    tied:
      ranked.filter((r) => r.valuation.total === standing.points).length > 1,
    winner: {
      name: top.name,
      points: top.valuation.total,
      you: top.seat === seat,
    },
  };
};

const economy: Builder = ({ events, seat }) => {
  const made = productionOf(events, seat);
  return made && { kind: 'economy', slot: 2, ...made };
};

const focus: Builder = ({ events, seat }) => {
  const spent = investmentOf(events, seat);
  const top = spent && focusOf(spent);
  return top && { kind: 'focus', slot: 3, ...top };
};

/** The loss of card 4; card 5 reads the same one. */
const lossOf = ({ events, seat }: Facts): Loss | null =>
  largestLoss(events, seat);

const loss: Builder = (f) => {
  const l = lossOf(f);
  if (!l) return null;
  const other =
    l.opponent === null
      ? undefined
      : f.report.rows.find((r) => r.seat === l.opponent);
  return {
    kind: 'loss',
    slot: 4,
    day: dayOf(f.report, l.at),
    points: l.points,
    role: l.role,
    opponent: other?.name ?? null,
    recordedOnly: hasOldVersion(f.events),
  };
};

const comeback: Builder = (f) => {
  const l = lossOf(f);
  const back = l && recoveryOf(f.events, f.seat, l);
  return (
    back && {
      kind: 'return',
      slot: 5,
      days: back.days,
      lossDay: dayOf(f.report, l.at),
    }
  );
};

const endzeit: Builder = ({ report, events, seat }) => {
  const e = endzeitOf(events, seat);
  return (
    e && { kind: 'endzeit', slot: 7, day: dayOf(report, e.at), gift: e.gift }
  );
};

/** The cards of the Rewind in the order of their slots. */
const CARDS: readonly Builder[] = [
  identity,
  economy,
  focus,
  loss,
  comeback,
  playtime,
  endzeit,
  rank,
];

/**
 * The Rewind of `seat` in a finished round: only the cards whose facts exist.
 * A provisional report (the running round) and a seat that is not among the
 * participants have no Rewind: the list is empty. `events` are the events of
 * the round in the order they were written (cards 2 to 5 and 7); without
 * them, or with events of version 1, those cards are left out.
 */
export function rewindOf(
  report: RoundReport,
  seat: number,
  events: readonly RewindEvent[] = [],
): Rewind {
  const ranked = rankRows(report.rows);
  const own = ranked.some((r) => r.seat === seat);
  const facts: Facts = { report, seat, ranked, events };
  const cards =
    report.round.provisional || !own
      ? []
      : CARDS.flatMap((build) => build(facts) ?? []);
  return { round: report.round.number, cards };
}
