// Players and accounts (#117): users with their research, sessions and the
// login tokens moderation revokes. Passkeys, passkey challenges and the other
// account tokens belong here too; they still run as raw SQL in passkeys.ts
// and account-security.ts until a follow-up moves them.
import type { Levels, ResearchQueue } from '../../../core/types.ts';
import type { ExplainMode } from '../../../core/explain.ts';
import type { Db } from '../database.ts';
import { levels, queueParams, researchQueueOf, type Row } from './rows.ts';

export interface User {
  id: string;
  name: string;
  email: string | null;
  salt: string;
  pw: string;
  admin: boolean;
  probes: number;
  /** Display option of the explanation texts (issue #63). */
  explain: ExplainMode;
  readAt: number;
  created: number;
  research: Levels;
  rq: ResearchQueue | null;
}

export interface Players {
  get(id: string): User | null;
  byName(name: string): User | null;
  byEmail(email: string): User | null;
  /** All players, the oldest first. */
  all(): User[];
  save(u: User): void;
  addSession(tokenHash: string, uid: string, expires: number): void;
  sessionUser(tokenHash: string, now: number): string | null;
  deleteSession(tokenHash: string): void;
  purgeSessions(now: number): number;
  /** Removes the open login codes of a player (moderation). */
  deleteLoginTokens(uid: string): void;
  /** Ends every session of a player; returns how many there were. */
  deleteSessions(uid: string): number;
}

export class SqlitePlayers implements Players {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  private userOf(r: Row | undefined): User | null {
    if (!r) return null;
    const research = this.db
      .prepare('SELECT key, level FROM user_research WHERE user_id = ?')
      .all(r.id) as Row[];
    return {
      id: r.id as string,
      name: r.name as string,
      email: (r.email as string | null) ?? null,
      salt: r.salt as string,
      pw: r.pw_hash as string,
      admin: r.admin === 1,
      probes: r.probes as number,
      explain: r.explain_mode as ExplainMode,
      readAt: r.read_at as number,
      created: r.created as number,
      research: levels(research, 'key', 'level'),
      rq: researchQueueOf(r),
    };
  }

  get(id: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row,
    );
  }

  byName(name: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE name = ?').get(name) as Row,
    );
  }

  byEmail(email: string): User | null {
    return this.userOf(
      this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row,
    );
  }

  all(): User[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY created, id')
      .all() as Row[];
    return rows.map((r) => this.userOf(r)!);
  }

  save(u: User): void {
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, salt, pw_hash, admin, probes, explain_mode, read_at, created,
           rq_key, rq_lvl, rq_start, rq_end, rq_cost_m, rq_cost_c, rq_cost_d, rq_planet)
         VALUES (@id, @name, @email, @salt, @pw, @admin, @probes, @explain, @readAt, @created,
           @rq_key, @rq_lvl, @rq_start, @rq_end, @rq_cost_m, @rq_cost_c, @rq_cost_d, @rq_planet)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email,
           salt = excluded.salt, pw_hash = excluded.pw_hash, admin = excluded.admin,
           probes = excluded.probes, explain_mode = excluded.explain_mode, read_at = excluded.read_at, rq_key = excluded.rq_key,
           rq_lvl = excluded.rq_lvl, rq_start = excluded.rq_start, rq_end = excluded.rq_end,
           rq_cost_m = excluded.rq_cost_m, rq_cost_c = excluded.rq_cost_c, rq_cost_d = excluded.rq_cost_d,
           rq_planet = excluded.rq_planet`,
      )
      .run({
        ...u,
        admin: u.admin ? 1 : 0,
        ...queueParams(u.rq, 'rq'),
        rq_planet: u.rq?.planet ?? null,
      });
    this.db.prepare('DELETE FROM user_research WHERE user_id = ?').run(u.id);
    const put = this.db.prepare(
      'INSERT INTO user_research (user_id, key, level) VALUES (?, ?, ?)',
    );
    for (const [k, l] of Object.entries(u.research)) put.run(u.id, k, l);
  }

  addSession(tokenHash: string, uid: string, expires: number): void {
    this.db
      .prepare('INSERT INTO sessions VALUES (?, ?, ?)')
      .run(tokenHash, uid, expires);
  }

  sessionUser(tokenHash: string, now: number): string | null {
    const r = this.db
      .prepare(
        'SELECT user_id FROM sessions WHERE token_hash = ? AND expires > ?',
      )
      .get(tokenHash, now) as Row | undefined;
    return (r?.user_id as string | undefined) ?? null;
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  purgeSessions(now: number): number {
    return this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now)
      .changes;
  }

  deleteLoginTokens(uid: string): void {
    this.db
      .prepare(
        "DELETE FROM account_tokens WHERE user_id = ? AND purpose = 'login'",
      )
      .run(uid);
  }

  deleteSessions(uid: string): number {
    return this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid)
      .changes;
  }
}
