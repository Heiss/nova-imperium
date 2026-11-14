// Trümmerfelder (#45): one row per position in the table `debris` of
// migration 15 (#119, O11), with Adamant and Psikristall as REAL like the
// planet stocks, so the 30 % share is not rounded. No owner: every player
// sees every field.
import type { Debris, DebrisField } from '../../../core/debris.ts';
import { placeId } from '../../../core/place.ts';
import type { Coords } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import type { Row } from './rows.ts';

export interface DebrisFields {
  /** The field of a place id (`d<g>_<s>_<p>`), or null. */
  get(id: string): DebrisField | null;
  /** Every field, by position. */
  all(): DebrisField[];
  /** Adds debris at a position: a new field, or more on the one there. */
  add(at: Coords, d: Debris): void;
  /** Stores what is left of a field. */
  save(f: DebrisField): void;
  delete(id: string): void;
  deleteAll(): void;
}

const fieldOf = (r: Row): DebrisField => ({
  id: r.id as string,
  g: r.g as number,
  s: r.s as number,
  p: r.p as number,
  m: r.res_m as number,
  c: r.res_c as number,
});

export class SqliteDebris implements DebrisFields {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  get(id: string): DebrisField | null {
    const r = this.db.prepare('SELECT * FROM debris WHERE id = ?').get(id) as
      Row | undefined;
    return r ? fieldOf(r) : null;
  }

  all(): DebrisField[] {
    const rows = this.db
      .prepare('SELECT * FROM debris ORDER BY g, s, p')
      .all() as Row[];
    return rows.map(fieldOf);
  }

  add(at: Coords, d: Debris): void {
    const { g, s, p } = at;
    this.db
      .prepare(
        `INSERT INTO debris (id, g, s, p, res_m, res_c) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET res_m = res_m + excluded.res_m,
           res_c = res_c + excluded.res_c`,
      )
      .run(placeId({ g, s, p, kind: 'debris' }), g, s, p, d.m, d.c);
  }

  save(f: DebrisField): void {
    this.db
      .prepare('UPDATE debris SET res_m = ?, res_c = ? WHERE id = ?')
      .run(f.m, f.c, f.id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM debris WHERE id = ?').run(id);
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM debris').run();
  }
}
