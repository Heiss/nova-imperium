// The thin Runden-Rewind (#235, view G) as pure rules: the facts of the story
// cards of one participant of a finished round, derived on read from the report
// of the archive (`RoundReport`). Nothing is stored (owner, 2026-11-16: no
// stored statistics); a card exists only when the facts it needs exist, so a
// round with a sparse history gets a shorter, honest Rewind (issue, view G:
// „no invented top 1 %, personality type or causal strategy label“). The words
// of the cards are in src/client/logic/round-rewind.ts; the server answers with
// these facts (src/server/game/round-report.ts, action `roundRewind`).
//
// Owner, 2026-11-20: this update has the cards 1 (identity), 6 (play time) and
// 8 (final place). The cards 2 to 5 and 7 need the in-round events of the
// issue's audit table (production, investment mix, battles, recovery, Endzeit)
// that the server does not write yet; each of them is one more entry of
// `CARDS` below (its own slot number of the issue's table, a `RewindCard`
// variant, a builder that returns null while its events are missing), so the
// order of the story stays the order of the slots.
import {
  type RoundCoverage,
  type RoundReport,
  rankRows,
  standingOf,
} from './round-report.ts';

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

export type RewindCard = IdentityCard | PlaytimeCard | RankCard;

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
}

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

/**
 * The cards of the Rewind in the order of their slots. The cards 2 to 5 and 7
 * of the issue go in here, between these, when their events are written.
 */
const CARDS: readonly Builder[] = [identity, playtime, rank];

/**
 * The Rewind of `seat` in a finished round: only the cards whose facts exist.
 * A provisional report (the running round) and a seat that is not among the
 * participants have no Rewind: the list is empty.
 */
export function rewindOf(report: RoundReport, seat: number): Rewind {
  const ranked = rankRows(report.rows);
  const own = ranked.some((r) => r.seat === seat);
  const facts: Facts = { report, seat, ranked };
  const cards =
    report.round.provisional || !own
      ? []
      : CARDS.flatMap((build) => build(facts) ?? []);
  return { round: report.round.number, cards };
}
