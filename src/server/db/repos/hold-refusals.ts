// The players who take no holds (#440, 230b: „Keine Wachen annehmen“): the
// table `hold_refusals` of migration 20261127T1800-hold-refusals, one row per
// player who switched the option on. Off is no row.
import type { Db } from '../database.ts';
import type { RoundReset } from '../round-reset.ts';
import type { RepositoryModule } from './contract.ts';

export interface HoldRefusals {
  /** Whether `uid` takes no holds. */
  refuses(uid: string): boolean;
  /** Switches the option of `uid` on or off. */
  set(uid: string, on: boolean): void;
}

class SqliteHoldRefusals implements HoldRefusals {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  refuses(uid: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM hold_refusals WHERE user_id = ?')
        .get(uid) !== undefined
    );
  }

  set(uid: string, on: boolean): void {
    if (on)
      this.db
        .prepare('INSERT OR IGNORE INTO hold_refusals (user_id) VALUES (?)')
        .run(uid);
    else
      this.db.prepare('DELETE FROM hold_refusals WHERE user_id = ?').run(uid);
  }
}

/** The players who take no holds (#440). */
export const repository = {
  key: 'holdRefusals',
  make: (db: Db): HoldRefusals => new SqliteHoldRefusals(db),
} as const satisfies RepositoryModule;

/** An option of the player, as the push kinds: it stays from round to round [V]. */
export const roundReset = [
  { keeps: ['hold_refusals'] },
] satisfies readonly RoundReset[];
