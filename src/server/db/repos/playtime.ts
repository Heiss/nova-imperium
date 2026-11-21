// The accepted intervals of the estimated active play time (#232): the table
// `playtime_events` of migration 20261119T1815-playtime-events. Append only;
// a total is derived from the rows by src/core/playtime.ts, never stored.
import type { MeasuredInterval } from '../../../core/round-report.ts';
import type {
  Interval,
  Last,
  PlaytimeState,
  Reason,
} from '../../../core/playtime.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { RoundReset } from '../round-reset.ts';

/** A row to append. */
export interface PlaytimeEvent extends Interval {
  user: string;
  round: number;
  session: number;
  instance: string;
  seq: number;
  state: PlaytimeState;
  reason: Reason;
  method: number;
}

/** The last interval of a player, whichever page reported it. */
interface LastOfPlayer {
  session: number;
  end: number;
  round: number;
}

export interface Playtime {
  /** The last accepted report of one page of a player, or null. */
  lastOfInstance(user: string, instance: string): Last | null;
  /** The player's last interval by its end, for the usage session. */
  lastOfPlayer(user: string): LastOfPlayer | null;
  /** Appends a row; false when the page's `seq` is stored already. */
  append(e: PlaytimeEvent): boolean;
  /**
   * The intervals of active time that touch [from, to) of one player, of
   * one round when `round` is given, ordered by start. Every row's interval
   * is active time, also the one of a row that ends it (the state is the
   * one the page moved to); a start has none.
   */
  active(user: string, from: number, to: number, round?: number): Interval[];
  /** The same for every player, as `[user, interval]`, ordered by player and start. */
  activeOfAll(from: number, to: number): [string, Interval][];
  /**
   * The intervals of active time of every player in one round that start
   * before `to`, with their method, as `[user, interval]` ordered by player and
   * start: what the close of the round archives (#235).
   */
  activeInRound(round: number, to: number): [string, MeasuredInterval][];
  /** Deletes the rows of a round with its archive (#232, #235: kept until the admin deletes the round). */
  deleteRound(round: number): number;
  /** The start of the player's first interval of any round, or null. */
  firstStart(user: string): number | null;
  /** The end of the player's last interaction (a start or an interval), or null. */
  lastActiveEnd(user: string): number | null;
  /** The end of the last interaction of every player. */
  lastActiveEnds(): Record<string, number>;
}

type Row = {
  start: number;
  end: number;
  user?: string;
  method?: number;
};

class SqlitePlaytime implements Playtime {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  lastOfInstance(user: string, instance: string): Last | null {
    // The interval of the last row: its start row is the page's latest one of
    // the reason `start`; the rows after it are the heartbeats and the stop.
    const row = this.db
      .prepare(
        `WITH opened AS (
           SELECT seq, end_ms FROM playtime_events
           WHERE user_id = @user AND instance = @instance AND reason = 'start'
           ORDER BY seq DESC LIMIT 1
         )
         SELECT e.seq, e.state, e.end_ms AS end,
                COALESCE((SELECT end_ms FROM opened), e.end_ms) AS opened,
                (SELECT COUNT(*) FROM playtime_events b
                 WHERE b.user_id = @user AND b.instance = @instance
                   AND b.seq > COALESCE((SELECT seq FROM opened), e.seq)) AS beats
         FROM playtime_events e
         WHERE e.user_id = @user AND e.instance = @instance
         ORDER BY e.seq DESC LIMIT 1`,
      )
      .get({ user, instance }) as Last | undefined;
    return row ?? null;
  }

  lastOfPlayer(user: string): LastOfPlayer | null {
    const row = this.db
      .prepare(
        `SELECT play_session AS session, end_ms AS end, round FROM playtime_events
         WHERE user_id = ? ORDER BY end_ms DESC, id DESC LIMIT 1`,
      )
      .get(user) as LastOfPlayer | undefined;
    return row ?? null;
  }

  append(e: PlaytimeEvent): boolean {
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO playtime_events
           (user_id, round, play_session, instance, seq, state, reason, start_ms, end_ms, method)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          e.user,
          e.round,
          e.session,
          e.instance,
          e.seq,
          e.state,
          e.reason,
          e.start,
          e.end,
          e.method,
        ).changes === 1
    );
  }

  active(user: string, from: number, to: number, round?: number): Interval[] {
    const rows = this.db
      .prepare(
        `SELECT start_ms AS start, end_ms AS end FROM playtime_events
         WHERE user_id = @user AND end_ms > start_ms
           AND end_ms > @from AND start_ms < @to
           AND (@round IS NULL OR round = @round)
         ORDER BY start_ms`,
      )
      .all({ user, from, to, round: round ?? null }) as Row[];
    return rows.map(({ start, end }) => ({ start, end }));
  }

  activeOfAll(from: number, to: number): [string, Interval][] {
    const rows = this.db
      .prepare(
        `SELECT user_id AS user, start_ms AS start, end_ms AS end FROM playtime_events
         WHERE end_ms > start_ms AND end_ms > ? AND start_ms < ?
         ORDER BY user_id, start_ms`,
      )
      .all(from, to) as Row[];
    return rows.map((r) => [r.user!, { start: r.start, end: r.end }]);
  }

  activeInRound(round: number, to: number): [string, MeasuredInterval][] {
    const rows = this.db
      .prepare(
        `SELECT user_id AS user, start_ms AS start, end_ms AS end, method
         FROM playtime_events
         WHERE round = ? AND end_ms > start_ms AND start_ms < ?
         ORDER BY user_id, start_ms`,
      )
      .all(round, to) as Row[];
    return rows.map((r) => [
      r.user!,
      { start: r.start, end: r.end, method: r.method! },
    ]);
  }

  deleteRound(round: number): number {
    return this.db
      .prepare('DELETE FROM playtime_events WHERE round = ?')
      .run(round).changes;
  }

  firstStart(user: string): number | null {
    const row = this.db
      .prepare(
        'SELECT MIN(start_ms) AS first FROM playtime_events WHERE user_id = ?',
      )
      .get(user) as { first: number | null };
    return row.first;
  }

  lastActiveEnd(user: string): number | null {
    const row = this.db
      .prepare(
        `SELECT MAX(end_ms) AS last FROM playtime_events
         WHERE user_id = ? AND (state = 'active' OR end_ms > start_ms)`,
      )
      .get(user) as { last: number | null };
    return row.last;
  }

  lastActiveEnds(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT user_id AS user, MAX(end_ms) AS last FROM playtime_events
         WHERE state = 'active' OR end_ms > start_ms GROUP BY user_id`,
      )
      .all() as { user: string; last: number }[];
    return Object.fromEntries(rows.map((r) => [r.user, r.last]));
  }
}

/** The accepted intervals of the estimated play time (#232). */
export const repository = {
  key: 'playtime',
  make: (db: Db): Playtime => new SqlitePlaytime(db),
} as const satisfies RepositoryModule;

/** The intervals carry their round; the archive reads them (#235). */
export const roundReset = [
  { keeps: ['playtime_events'] },
] satisfies readonly RoundReset[];
