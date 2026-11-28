// The newest highscore pass (#491): the table `score_pass` of migration
// 20261128T1300-score-pass, one row at most. The pass of the clock and of a
// reader is written here with each new pass (src/server/game/scores.ts), so
// a restart reads it instead of making a new one outside the schedule.
import type { Db } from '../database.ts';
import type { RoundReset } from '../round-reset.ts';
import type { RepositoryModule } from './contract.ts';

/** A stored pass: the round it was made for, when, and its scores as stored. */
interface StoredPass<P> {
  round: string;
  at: number;
  pass: P;
}

export interface ScorePasses {
  /** The stored pass, or none. */
  get<P>(): StoredPass<P> | null;
  /** Replaces the stored pass. */
  save<P>(stored: StoredPass<P>): void;
}

class SqliteScorePasses implements ScorePasses {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get<P>(): StoredPass<P> | null {
    const row = this.db
      .prepare('SELECT round, at, pass FROM score_pass WHERE id = 1')
      .get() as { round: string; at: number; pass: string } | undefined;
    return row
      ? { round: row.round, at: row.at, pass: JSON.parse(row.pass) as P }
      : null;
  }

  save<P>(stored: StoredPass<P>): void {
    this.db
      .prepare(
        `INSERT INTO score_pass (id, round, at, pass) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET round = excluded.round, at = excluded.at,
           pass = excluded.pass`,
      )
      .run(stored.round, stored.at, JSON.stringify(stored.pass));
  }
}

/** The stored highscore pass on `Ctx` (#491). */
export const repository = {
  key: 'scorePasses',
  make: (db: Db): ScorePasses => new SqliteScorePasses(db),
} as const satisfies RepositoryModule;

/** A new round empties it: its own pass is made in its transaction. */
export const roundReset = [
  { order: 106, clears: ['score_pass'] },
] satisfies readonly RoundReset[];
