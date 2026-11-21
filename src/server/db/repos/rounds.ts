// The archive of the rounds (#235): the identity and lifecycle of each round,
// who took part, and its durable event history. The rules of what is written
// when are in src/server/game/round-archive.ts, the reading in
// src/server/game/round-report.ts.
import { ENDZEIT_EVENT, EVENT_KIND } from '../../../core/round-events.ts';
import type { RoundCoverage, RoundStatus } from '../../../core/round-report.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

export interface RoundRow {
  number: number;
  status: RoundStatus;
  started: number;
  /** The cutoff of the close; null while the round runs. */
  closed: number | null;
  coverage: RoundCoverage;
  /** The rules the round ran under; `{}` until the close fixes them for a round of the migration. */
  rules: Record<string, unknown>;
  /** The number of events the close expects the round to hold; null while it runs. */
  events: number | null;
}

interface Participant {
  round: number;
  /** The place in the round: stable, and the only reference events make to a player. */
  seat: number;
  /** The account; null once it is deleted (#235, D4). */
  player: string | null;
  name: string;
}

interface RoundEvent {
  id: number;
  round: number;
  /** When the fact took effect, and when it was written. */
  at: number;
  recorded: number;
  kind: string;
  seat: number | null;
  version: number;
  payload: Record<string, unknown>;
}

/** An event to write; the round and the time of writing are given with it. */
interface NewRoundEvent {
  at: number;
  kind: string;
  seat?: number | null;
  version?: number;
  payload?: object;
}

export interface RoundArchive {
  get(number: number): RoundRow | null;
  /** Every round, the newest first. */
  all(): RoundRow[];
  /** Starts a round; a number that exists already is refused by the database. */
  open(
    r: Pick<RoundRow, 'number' | 'started' | 'coverage'> & { rules: object },
  ): void;
  /** Closes a round: the cutoff, the rules it ran under and the number of events it holds. */
  close(number: number, closed: number, rules: object, events: number): void;
  /** Deletes a round with its participants and events. */
  delete(number: number): void;
  addParticipant(p: Participant): void;
  /** Whether the round exists and still runs: the cheap check before an event is written. */
  isActive(number: number): boolean;
  /** The seat of an account in a round, or null if it has none. */
  seatOf(round: number, player: string): number | null;
  /** The next free seat of a round: one above the highest. */
  nextSeat(round: number): number;
  participants(round: number): Participant[];
  /** The numbers of the rounds the account took part in. */
  roundsOf(player: string): number[];
  addEvent(round: number, recorded: number, e: NewRoundEvent): void;
  events(round: number, kind?: string): RoundEvent[];
  /**
   * The events of a round that the cards of the Runden-Rewind of one seat can
   * read (#235): those of the seat, the battles that name it as target or send
   * it a battle report, the events with a place of the seat in their `prod`, the
   * fleets of the unions the seat sent a fleet into, the ring-in of the Endzeit,
   * and one event of version 1 of the journal if the round holds any. In the
   * same order as `events`; the result of the cards is the same as with all.
   */
  eventsForSeat(round: number, seat: number): RoundEvent[];
  countEvents(round: number): number;
}

const rowOf = (r: Row): RoundRow => ({
  number: r.number as number,
  status: r.status as RoundStatus,
  started: r.started as number,
  closed: r.closed as number | null,
  coverage: r.coverage as RoundCoverage,
  rules: JSON.parse(r.rules as string) as Record<string, unknown>,
  events: r.events as number | null,
});

const participantOf = (r: Row): Participant => ({
  round: r.round as number,
  seat: r.seat as number,
  player: r.player as string | null,
  name: r.name as string,
});

const eventOf = (r: Row): RoundEvent => ({
  id: r.id as number,
  round: r.round as number,
  at: r.at as number,
  recorded: r.recorded as number,
  kind: r.kind as string,
  seat: r.seat as number | null,
  version: r.version as number,
  payload: JSON.parse(r.payload as string) as Record<string, unknown>,
});

class SqliteRounds implements RoundArchive {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(number: number): RoundRow | null {
    const r = this.db
      .prepare('SELECT * FROM rounds WHERE number = ?')
      .get(number) as Row | undefined;
    return r ? rowOf(r) : null;
  }

  all(): RoundRow[] {
    return (
      this.db
        .prepare('SELECT * FROM rounds ORDER BY number DESC')
        .all() as Row[]
    ).map(rowOf);
  }

  open(
    r: Pick<RoundRow, 'number' | 'started' | 'coverage'> & { rules: object },
  ): void {
    this.db
      .prepare(
        `INSERT INTO rounds (number, status, started, closed, coverage, rules, events)
         VALUES (?, 'active', ?, NULL, ?, ?, NULL)`,
      )
      .run(r.number, r.started, r.coverage, JSON.stringify(r.rules));
  }

  close(number: number, closed: number, rules: object, events: number): void {
    this.db
      .prepare(
        `UPDATE rounds SET status = 'closed', closed = ?, rules = ?, events = ?
         WHERE number = ? AND status = 'active'`,
      )
      .run(closed, JSON.stringify(rules), events, number);
  }

  delete(number: number): void {
    this.db.prepare('DELETE FROM rounds WHERE number = ?').run(number);
  }

  addParticipant(p: Participant): void {
    this.db
      .prepare(
        'INSERT INTO round_participants (round, seat, player, name) VALUES (?, ?, ?, ?)',
      )
      .run(p.round, p.seat, p.player, p.name);
  }

  isActive(number: number): boolean {
    return (
      this.db
        .prepare("SELECT 1 FROM rounds WHERE number = ? AND status = 'active'")
        .pluck()
        .get(number) !== undefined
    );
  }

  seatOf(round: number, player: string): number | null {
    return (
      (this.db
        .prepare(
          'SELECT seat FROM round_participants WHERE round = ? AND player = ?',
        )
        .pluck()
        .get(round, player) as number | undefined) ?? null
    );
  }

  nextSeat(round: number): number {
    return (
      ((this.db
        .prepare('SELECT MAX(seat) FROM round_participants WHERE round = ?')
        .pluck()
        .get(round) as number | null) ?? 0) + 1
    );
  }

  participants(round: number): Participant[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM round_participants WHERE round = ? ORDER BY seat',
        )
        .all(round) as Row[]
    ).map(participantOf);
  }

  roundsOf(player: string): number[] {
    return this.db
      .prepare(
        'SELECT round FROM round_participants WHERE player = ? ORDER BY round DESC',
      )
      .pluck()
      .all(player) as number[];
  }

  addEvent(round: number, recorded: number, e: NewRoundEvent): void {
    this.db
      .prepare(
        `INSERT INTO round_events (round, at, recorded, kind, seat, version, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        round,
        e.at,
        recorded,
        e.kind,
        e.seat ?? null,
        e.version ?? 1,
        JSON.stringify(e.payload ?? {}),
      );
  }

  events(round: number, kind?: string): RoundEvent[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM round_events WHERE round = ? AND (? IS NULL OR kind = ?)
           ORDER BY at, id`,
        )
        .all(round, kind ?? null, kind ?? null) as Row[]
    ).map(eventOf);
  }

  eventsForSeat(round: number, seat: number): RoundEvent[] {
    const journal = Object.values(EVENT_KIND);
    return (
      this.db
        .prepare(
          `SELECT * FROM round_events WHERE round = ? AND (
             seat = ?
             OR json_extract(payload, '$.target') = ?
             OR kind = ?
             OR EXISTS (SELECT 1 FROM json_each(payload, '$.prod')
                        WHERE json_extract(value, '$.owner') = ?)
             OR EXISTS (SELECT 1 FROM json_each(payload, '$.reports')
                        WHERE json_extract(value, '$.type') = 'battle'
                          AND json_extract(value, '$.to') = ?)
             OR json_extract(payload, '$.fleet') IN (
                  SELECT json_extract(u.payload, '$.input.union')
                  FROM round_events u
                  WHERE u.round = ? AND u.seat = ? AND u.kind = ?
                    AND json_extract(u.payload, '$.cause') = 'send'
                    AND json_extract(u.payload, '$.ok') = 1)
             OR id = (SELECT MIN(o.id) FROM round_events o
                      WHERE o.round = ? AND o.version < 2
                        AND o.kind IN (${journal.map(() => '?').join(', ')}))
           ) ORDER BY at, id`,
        )
        .all(
          round,
          seat,
          seat,
          ENDZEIT_EVENT,
          seat,
          seat,
          round,
          seat,
          EVENT_KIND.action,
          round,
          ...journal,
        ) as Row[]
    ).map(eventOf);
  }

  countEvents(round: number): number {
    return this.db
      .prepare('SELECT COUNT(*) FROM round_events WHERE round = ?')
      .pluck()
      .get(round) as number;
  }
}

/** The archive of the rounds and their event history (#235). */
export const repository = {
  key: 'rounds',
  make: (db: Db): RoundArchive => new SqliteRounds(db),
} as const satisfies RepositoryModule;

/** The archive of the rounds is kept on purpose until the admin deletes a round (#235). */
export const roundReset = [
  { keeps: ['rounds', 'round_events', 'round_participants'] },
] satisfies readonly RoundReset[];
