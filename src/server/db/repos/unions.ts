// The attack unions (#466): the table `attack_unions` of migration
// 20261128T0300-attack-union-rows, one row per union with its leader, its
// target, its fixed arrival X and the leader's fleet that leads it. The
// fleets of a union carry its ID (`fleets.union_id`) and its invitations are
// rows of `attack_union_invites`, both in the fleets repository.
import type { Coords } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import type { RoundReset } from '../round-reset.ts';
import type { RepositoryModule } from './contract.ts';
import type { Row } from './rows.ts';

/** An attack union as its row holds it. */
export interface Union {
  id: string;
  leader: string;
  /** The leader's fleet that leads the battle; none while he has sent none. */
  lead?: string;
  /** The place it flies to, a planet or a moon. */
  target: string;
  toC: Coords;
  /** When every fleet of it arrives (X). */
  arr: number;
}

export interface Unions {
  get(id: string): Union | null;
  /** Saves a union, a new one or one whose leading fleet changes. */
  save(u: Union): void;
  /** Deletes a union that is over, with its invitations. */
  delete(id: string): void;
  /**
   * Deletes the unions whose arrival is at or before `now`, with their
   * invitations: a union no fleet reached ends silently (#466 [V]).
   */
  purge(now: number): number;
}

const unionOf = (r: Row): Union => ({
  id: r.id as string,
  leader: r.leader as string,
  ...(typeof r.lead === 'string' && { lead: r.lead }),
  target: r.target as string,
  toC: { g: r.to_g as number, s: r.to_s as number, p: r.to_p as number },
  arr: r.arr as number,
});

class SqliteUnions implements Unions {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(id: string): Union | null {
    const row = this.db
      .prepare('SELECT * FROM attack_unions WHERE id = ?')
      .get(id) as Row | undefined;
    return row ? unionOf(row) : null;
  }

  save(u: Union): void {
    this.db
      .prepare(
        `INSERT INTO attack_unions (id, leader, lead, target, to_g, to_s, to_p, arr)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET lead = excluded.lead`,
      )
      .run(
        u.id,
        u.leader,
        u.lead ?? null,
        u.target,
        u.toC.g,
        u.toC.s,
        u.toC.p,
        u.arr,
      );
  }

  delete(id: string): void {
    this.db
      .prepare('DELETE FROM attack_union_invites WHERE union_id = ?')
      .run(id);
    this.db.prepare('DELETE FROM attack_unions WHERE id = ?').run(id);
  }

  purge(now: number): number {
    this.db
      .prepare(
        'DELETE FROM attack_union_invites WHERE union_id IN (SELECT id FROM attack_unions WHERE arr <= ?)',
      )
      .run(now);
    return this.db.prepare('DELETE FROM attack_unions WHERE arr <= ?').run(now)
      .changes;
  }
}

/** The attack unions on `Ctx` (#466). */
export const repository = {
  key: 'unions',
  make: (db: Db): Unions => new SqliteUnions(db),
} as const satisfies RepositoryModule;

/** The unions go with the round, like the fleets and the invitations. */
export const roundReset = [
  { order: 105, clears: ['attack_unions'] },
] satisfies readonly RoundReset[];
