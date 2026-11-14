// Reports (#117): the messages of a player, kept up to a limit.
import type { Db } from '../database.ts';
import type { Row } from './rows.ts';

export interface Report {
  id: string;
  time: number;
  type: 'info' | 'spy' | 'battle';
  title: string;
  [field: string]: unknown;
}

export interface Reports {
  /** Adds a report and keeps only the newest `keep` of the player. */
  add(uid: string, report: Report, keep: number): void;
  /** The newest report first (the order in which they were written). */
  ofPlayer(uid: string): Report[];
  delete(uid: string, id: string): void;
  deleteAll(uid: string): void;
}

export class SqliteReports implements Reports {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  add(uid: string, report: Report, keep: number): void {
    const { id, time, type, title, ...body } = report;
    const seq = this.db
      .prepare(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM reports WHERE user_id = ?',
      )
      .get(uid) as Row;
    this.db
      .prepare(
        'INSERT INTO reports (id, user_id, time, seq, type, title, body) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, uid, time, seq.n, type, title, JSON.stringify(body));
    this.db
      .prepare(
        `DELETE FROM reports WHERE user_id = ? AND id NOT IN
         (SELECT id FROM reports WHERE user_id = ? ORDER BY seq DESC LIMIT ?)`,
      )
      .run(uid, uid, keep);
  }

  ofPlayer(uid: string): Report[] {
    const rows = this.db
      .prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY seq DESC')
      .all(uid) as Row[];
    return rows.map((r) => ({
      ...(JSON.parse(r.body as string) as Record<string, unknown>),
      id: r.id as string,
      time: r.time as number,
      type: r.type as Report['type'],
      title: r.title as string,
    }));
  }

  delete(uid: string, id: string): void {
    this.db
      .prepare('DELETE FROM reports WHERE user_id = ? AND id = ?')
      .run(uid, id);
  }

  deleteAll(uid: string): void {
    this.db.prepare('DELETE FROM reports WHERE user_id = ?').run(uid);
  }
}
