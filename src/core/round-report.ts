// The report of an archived round (#235) as pure rules: the shapes of the
// facts the close writes (`player.final`, `guild.final`), the rows the report
// shows and their ranking. The server writes and reads them
// (src/server/game/round-archive.ts, round-report.ts), the browser shows
// them (src/client/logic/round-archive.ts). Everything is a fact of the
// cutoff or derived from facts on read; nothing here is stored as a total
// (owner, 2026-11-16: no stored statistics).
import { activeMs, type Interval, union } from './playtime.ts';
import type { Levels, Resources } from './types.ts';

export type RoundStatus = 'active' | 'closed';
/** „partial“: the round ran before the archive existed, its early history is missing. */
export type RoundCoverage = 'complete' | 'partial';

/** The pseudonym of an account deleted after the round (#235, D4, [V]). */
export const DELETED_PLAYER = 'Gelöschter Spieler';

/** The points of a player at the cutoff, by the categories of the highscore (#78). */
export interface Valuation {
  total: number;
  buildings: number;
  research: number;
  fleet: number;
  defense: number;
}

/** What stood on a planet or moon at the cutoff, as the game holds it. */
export interface FinalPlace {
  kind: 'planet' | 'moon';
  g: number;
  s: number;
  p: number;
  b: Levels;
  ships: Levels;
  def: Levels;
}

/** The payload of the event `player.final`: one participant at the cutoff. */
export interface PlayerFinal {
  /** The points under the rules in force at the cutoff. */
  valuation: Valuation;
  /** The production per hour of all planets and moons as it ran at the cutoff. */
  economy: Resources;
  research: Levels;
  places: FinalPlace[];
  /** The ships on their way at the cutoff, all fleets together. */
  flying: Levels;
  vacation: boolean;
}

/** The payload of the event `guild.final`: a guild at the cutoff, its members by seat. */
export interface GuildFinal {
  tag: string;
  name: string;
  seats: number[];
}

/** The payload of the event `round.closed`: lifecycle only, no totals. */
export interface RoundClosed {
  cutoff: number;
  participants: number;
}

/**
 * The payload of the event `player.playtime` (#235 × #232, D2): the accepted
 * intervals of active time of one participant in the round, merged where they
 * touch or overlap (so two pages count once), as `[start, end]` pairs in UTC
 * milliseconds up to the cutoff, and the versions of the method that measured
 * them. No page, no sequence number, no session: the report derives the sum
 * on read (`playtimeMs`); the intervals are no stored total.
 */
export interface PlayerPlaytime {
  methods: number[];
  intervals: [number, number][];
}

/** An accepted interval as the table stores it: with the method that measured it. */
export type MeasuredInterval = Interval & { method: number };

/**
 * The payload of one participant from the stored intervals of the round:
 * what lies after the cutoff is cut off (a closed round is frozen), the rest
 * merged. A participant without active time gets empty lists, which is
 * a measured zero, not an unknown value.
 */
export function playtimePayload(
  rows: readonly MeasuredInterval[],
  cutoff: number,
): PlayerPlaytime {
  const kept = rows
    .filter((r) => r.start < cutoff && r.end > r.start)
    .map((r) => ({ ...r, end: Math.min(r.end, cutoff) }));
  return {
    methods: [...new Set(kept.map((r) => r.method))].sort((a, b) => a - b),
    intervals: union(kept).map((i): [number, number] => [i.start, i.end]),
  };
}

/** The active time of an archived payload in milliseconds, each real second once. */
export const playtimeMs = (p: PlayerPlaytime): number =>
  activeMs(
    p.intervals.map(([start, end]) => ({ start, end })),
    0,
    Number.MAX_SAFE_INTEGER,
  );

/** One row of the participant overview of a report. */
export interface ReportRow {
  seat: number;
  name: string;
  /** Whether the row is the reader's own. */
  you: boolean;
  valuation: Valuation;
  economy: Resources;
  planets: number;
  moons: number;
  guild: { tag: string; name: string } | null;
}

export type ReportCategory = keyof Valuation;

/** The rows by their points in `cat`, best first; equal points keep the order of the seats. */
export function rankRows(
  rows: readonly ReportRow[],
  cat: ReportCategory = 'total',
): ReportRow[] {
  return [...rows].sort(
    (a, b) => b.valuation[cat] - a.valuation[cat] || a.seat - b.seat,
  );
}

/** A reader's place: the rank by the total points, among how many. */
export interface Standing {
  rank: number;
  of: number;
  points: number;
}

/** The standing of `seat`, or null when it is not among the rows. */
export function standingOf(
  rows: readonly ReportRow[],
  seat: number,
): Standing | null {
  const ranked = rankRows(rows);
  const index = ranked.findIndex((r) => r.seat === seat);
  const row = ranked[index];
  return row
    ? { rank: index + 1, of: ranked.length, points: row.valuation.total }
    : null;
}

/** The sum of the three resources; an unweighted sum, not a value (#235, metric dictionary). */
export const resourceSum = (r: Resources): number => r.m + r.c + r.d;

/** Days from `from` to `to`, rounded up, at least 1; the length of a round. */
export const roundDays = (from: number, to: number): number =>
  Math.max(1, Math.ceil((to - from) / 86400000));

/** The places of a participant: how many planets and how many moons. */
export const placeCounts = (
  places: readonly Pick<FinalPlace, 'kind'>[],
): { planets: number; moons: number } => ({
  planets: places.filter((p) => p.kind === 'planet').length,
  moons: places.filter((p) => p.kind === 'moon').length,
});

/** One line of the list of rounds. */
export interface RoundEntry {
  number: number;
  status: RoundStatus;
  started: number;
  closed: number | null;
  coverage: RoundCoverage;
  /** The running round: for a player only the lock, for the admin a provisional report. */
  locked: boolean;
  participants: number | null;
  you: Standing | null;
}

/** The report of one round. */
export interface RoundReport {
  round: {
    number: number;
    provisional: boolean;
    /** The cutoff of a finished round, the time of reading for a provisional one. */
    asOf: number;
    started: number;
    closed: number | null;
    days: number;
    coverage: RoundCoverage;
    rules: Record<string, unknown>;
  };
  you: Standing | null;
  /** Every participant by the total points, best first. */
  rows: ReportRow[];
  guilds: { tag: string; name: string; members: number; points: number }[];
  /**
   * The estimated active play time in milliseconds per seat, derived on read
   * from the events `player.playtime` and shared with every reader of a
   * finished round (D2). Null for a provisional report (during the round the
   * time stays private) and for a round closed before it was archived.
   */
  playtime: Record<number, number> | null;
}

/**
 * One participant of a round as the admin inspects them (#235, view H, the
 * drilldown): the facts of the cutoff, or of the moment of reading for the
 * running round, that the report's ranking reduces to a row. No account id.
 */
export interface ParticipantReport {
  round: { number: number; provisional: boolean; asOf: number };
  seat: number;
  name: string;
  guild: { tag: string; name: string } | null;
  valuation: Valuation;
  economy: Resources;
  research: Levels;
  places: FinalPlace[];
  /** The ships on their way, all fleets together. */
  flying: Levels;
  vacation: boolean;
  /** The estimated active time in milliseconds; null for the running round and for an archive without it. */
  playtime: number | null;
}

/** One round in the history across rounds. */
export interface HistoryEntry {
  number: number;
  started: number;
  closed: number;
  days: number;
  coverage: RoundCoverage;
  rules: Record<string, unknown>;
  participants: number;
  winner: { name: string; points: number } | null;
  you:
    | (Standing &
        Pick<ReportRow, 'valuation' | 'economy' | 'planets' | 'moons'>)
    | null;
}
