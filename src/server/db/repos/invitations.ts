// Invitations (#117): registration only by invitation.
import type { Db } from '../database.ts';
import type { Row } from './rows.ts';

export interface Invitation {
  id: string;
  email: string;
  tokenHash: string;
  createdBy: string | null;
  created: number;
  expires: number;
  usedAt: number | null;
  revokedAt: number | null;
}

export interface Invitations {
  add(i: Invitation): void;
  byToken(tokenHash: string): Invitation | null;
  /** Invitations that can still be used, the newest first. */
  open(now: number): Invitation[];
  /** Revokes the open invitations of an address (or one by id). */
  revoke(where: { email?: string; id?: string }, now: number): number;
  use(id: string, now: number): void;
}

export class SqliteInvitations implements Invitations {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  private invitationOf(r: Row | undefined): Invitation | null {
    if (!r) return null;
    return {
      id: r.id as string,
      email: r.email as string,
      tokenHash: r.token_hash as string,
      createdBy: (r.created_by as string | null) ?? null,
      created: r.created as number,
      expires: r.expires as number,
      usedAt: (r.used_at as number | null) ?? null,
      revokedAt: (r.revoked_at as number | null) ?? null,
    };
  }

  add(i: Invitation): void {
    this.db
      .prepare(
        `INSERT INTO invitations (id, email, token_hash, created_by, created, expires, used_at, revoked_at)
         VALUES (@id, @email, @tokenHash, @createdBy, @created, @expires, @usedAt, @revokedAt)`,
      )
      .run(i);
  }

  byToken(tokenHash: string): Invitation | null {
    return this.invitationOf(
      this.db
        .prepare('SELECT * FROM invitations WHERE token_hash = ?')
        .get(tokenHash) as Row,
    );
  }

  open(now: number): Invitation[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires > ?
         ORDER BY created DESC, id`,
      )
      .all(now) as Row[];
    return rows.map((r) => this.invitationOf(r)!);
  }

  revoke(where: { email?: string; id?: string }, now: number): number {
    const sql = `UPDATE invitations SET revoked_at = ? WHERE used_at IS NULL AND revoked_at IS NULL AND ${
      where.id ? 'id = ?' : 'email = ?'
    }`;
    return this.db.prepare(sql).run(now, where.id ?? where.email ?? '').changes;
  }

  use(id: string, now: number): void {
    this.db
      .prepare('UPDATE invitations SET used_at = ? WHERE id = ?')
      .run(now, id);
  }
}
