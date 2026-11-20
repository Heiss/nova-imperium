// The last hostile targets of a player (#292): the table `last_targets` of
// migration 20261119T1830-last-targets, one row per player and target place.
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

/** How many targets are kept per player [V]; the list shows five, the rest fills it up when one drops out. */
export const KEPT_TARGETS = 20;

/** A remembered target: the place, the owner it had then and when it was aimed at. */
interface LastTarget {
  place: string;
  owner: string;
  at: number;
}

export interface LastTargets {
  /** The targets of `uid`, newest first. */
  of(uid: string): LastTarget[];
  /** Remembers a launch of `uid` at `place`, an older entry of the same place is replaced; the oldest beyond `KEPT_TARGETS` go. */
  record(uid: string, target: LastTarget): void;
  deleteAll(): void;
}

class SqliteLastTargets implements LastTargets {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  of(uid: string): LastTarget[] {
    const rows = this.db
      .prepare(
        'SELECT place, owner, at FROM last_targets WHERE user_id = ? ORDER BY at DESC, place',
      )
      .all(uid) as Row[];
    return rows.map((r) => ({
      place: r.place as string,
      owner: r.owner as string,
      at: r.at as number,
    }));
  }

  record(uid: string, t: LastTarget): void {
    this.db
      .prepare(
        `INSERT INTO last_targets (user_id, place, owner, at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, place) DO UPDATE SET owner = excluded.owner, at = excluded.at`,
      )
      .run(uid, t.place, t.owner, t.at);
    this.db
      .prepare(
        `DELETE FROM last_targets WHERE user_id = ? AND place NOT IN (
           SELECT place FROM last_targets WHERE user_id = ?
           ORDER BY at DESC, place LIMIT ?)`,
      )
      .run(uid, uid, KEPT_TARGETS);
  }

  deleteAll(): void {
    this.db.exec('DELETE FROM last_targets');
  }
}

/** The last hostile targets of a player (#292). */
export const repository = {
  key: 'targets',
  make: (db: Db): LastTargets => new SqliteLastTargets(db),
} as const satisfies RepositoryModule;

/** The last targets name places of the old round (#292). */
export const roundReset = [
  { order: 60, clears: ['last_targets'] },
] satisfies readonly RoundReset[];
