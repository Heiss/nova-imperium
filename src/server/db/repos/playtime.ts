// The accepted intervals of the estimated active play time (#232): the table
// `playtime_events` of migration 20261119T1815-playtime-events. Append only;
// a total is derived from the rows by src/core/playtime.ts, never stored.
import type {
  Interval,
  Last,
  PlaytimeState,
  Reason,
} from '../../../core/playtime.ts';
import type { Db } from '../database.ts';

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
export interface LastOfPlayer {
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
   * one round when `round` is given, ordered by start.
   */
  active(user: string, from: number, to: number, round?: number): Interval[];
  /** The same for every player, as `[user, interval]`, ordered by player and start. */
  activeOfAll(from: number, to: number): [string, Interval][];
  /** The start of the player's first interval of any round, or null. */
  firstStart(user: string): number | null;
  /** The end of the player's last interval of active time, or null. */
  lastActiveEnd(user: string): number | null;
  /** The end of the last interval of active time of every player. */
  lastActiveEnds(): Record<string, number>;
}

type Row = { start: number; end: number; user?: string };

export class SqlitePlaytime implements Playtime {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  lastOfInstance(user: string, instance: string): Last | null {
    const row = this.db
      .prepare(
        `SELECT seq, state, end_ms AS end FROM playtime_events
         WHERE user_id = ? AND instance = ? ORDER BY seq DESC LIMIT 1`,
      )
      .get(user, instance) as Last | undefined;
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
         WHERE user_id = @user AND state = 'active' AND end_ms > start_ms
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
         WHERE state = 'active' AND end_ms > start_ms AND end_ms > ? AND start_ms < ?
         ORDER BY user_id, start_ms`,
      )
      .all(from, to) as Row[];
    return rows.map((r) => [r.user!, { start: r.start, end: r.end }]);
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
         WHERE user_id = ? AND state = 'active'`,
      )
      .get(user) as { last: number | null };
    return row.last;
  }

  lastActiveEnds(): Record<string, number> {
    const rows = this.db
      .prepare(
        `SELECT user_id AS user, MAX(end_ms) AS last FROM playtime_events
         WHERE state = 'active' GROUP BY user_id`,
      )
      .all() as { user: string; last: number }[];
    return Object.fromEntries(rows.map((r) => [r.user, r.last]));
  }
}
