// The attack unions (#466): the table `attack_unions` of migration
// 20261128T0300-attack-union-rows, one row per union with its leader, its
// target, its fixed arrival X and the leader's fleet that leads it; with
// 20261128T1000-union-planned-start the start of that fleet while it is
// planned for later (#478). The
// fleets of a union carry its ID (`fleets.union_id`) and its invitations are
// rows of `attack_union_invites`, both in the fleets repository.
import type { Coords, Levels } from '../../../core/types.ts';
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
  /**
   * The start of the leader's fleet while it is planned for later (#478,
   * owner, 2026-11-28): the ships stay on the planet `from` until `at`, then
   * fly at the speed step `pct` (tenths, 1 to 10). None once it started.
   */
  start?: PlannedStart;
}

/** The planned start of a leader's fleet (#478). */
export interface PlannedStart {
  at: number;
  from: string;
  ships: Levels;
  pct: number;
}

export interface Unions {
  get(id: string): Union | null;
  /** Saves a union, a new one or one whose leading fleet or planned start changes. */
  save(u: Union): void;
  /** The unions whose planned start is at or before `now`, the earliest first (#478). */
  dueStarts(now: number): Union[];
  /** The planned starts from the planet `planet`, of every union (#478). */
  startsFrom(planet: string): Union[];
  /** The IDs of the unions `uid` leads, by arrival. */
  ledBy(uid: string): string[];
  /** Deletes a union that is over, with its invitations. */
  delete(id: string): void;
  /**
   * Deletes the unions whose arrival is at or before `now` and that have no
   * fleet out any more, with their invitations: a union no fleet reached
   * ends silently (#466 [V]).
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
  ...(typeof r.start_at === 'number' && {
    start: {
      at: r.start_at,
      from: r.start_from as string,
      ships: JSON.parse(r.start_ships as string) as Levels,
      pct: r.start_pct as number,
    },
  }),
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
        `INSERT INTO attack_unions (id, leader, lead, target, to_g, to_s, to_p, arr,
           start_at, start_from, start_ships, start_pct)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET lead = excluded.lead,
           start_at = excluded.start_at, start_from = excluded.start_from,
           start_ships = excluded.start_ships, start_pct = excluded.start_pct`,
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
        u.start?.at ?? null,
        u.start?.from ?? null,
        u.start ? JSON.stringify(u.start.ships) : null,
        u.start?.pct ?? null,
      );
  }

  dueStarts(now: number): Union[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM attack_unions WHERE start_at <= ? ORDER BY start_at, id',
      )
      .all(now) as Row[];
    return rows.map(unionOf);
  }

  startsFrom(planet: string): Union[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM attack_unions WHERE start_from = ? AND start_at IS NOT NULL ORDER BY start_at, id',
      )
      .all(planet) as Row[];
    return rows.map(unionOf);
  }

  ledBy(uid: string): string[] {
    const rows = this.db
      .prepare('SELECT id FROM attack_unions WHERE leader = ? ORDER BY arr, id')
      .all(uid) as Row[];
    return rows.map((r) => r.id as string);
  }

  delete(id: string): void {
    this.db
      .prepare('DELETE FROM attack_union_invites WHERE union_id = ?')
      .run(id);
    this.db.prepare('DELETE FROM attack_unions WHERE id = ?').run(id);
  }

  purge(now: number): number {
    // A union whose fleets are still out arrives with them first (the tick).
    const over = `SELECT id FROM attack_unions WHERE arr <= ? AND NOT EXISTS (
      SELECT 1 FROM fleets WHERE fleets.union_id = attack_unions.id AND fleets.state = 'out')`;
    this.db
      .prepare(`DELETE FROM attack_union_invites WHERE union_id IN (${over})`)
      .run(now);
    return this.db
      .prepare(`DELETE FROM attack_unions WHERE id IN (${over})`)
      .run(now).changes;
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
