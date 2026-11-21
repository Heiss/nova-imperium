// Admin data (#117): the settings of the universe and the round, the audit
// log, player activity, suspensions and the retention of the error log.
// The error log itself is still raw SQL in error-log.ts until a follow-up.
import { UNIVERSE_SPECS } from '../../../core/universe.ts';
import type { Universe } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import { levels, type Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

/** The filter of the audit list (built by `auditFilter` in audit.ts). */
export interface AuditFilter {
  player: string;
  action: string;
  requestId: string;
  reference: string;
  outcome: string;
  since: number;
  until: number;
  before: number;
}

export interface AuditEvent {
  time: number;
  actor: string | null;
  category: string;
  action: string;
  outcome: string;
  target: string | null;
  requestId: string | null;
  detail: string;
}

interface Suspension {
  reason: string;
  until: number | null;
}

export interface Admin {
  universe(): Universe;
  saveUniverse(u: Universe): void;
  /** One stored setting, or undefined (the „Endzeit“ of #161, the round of #283). */
  setting(key: string): number | undefined;
  /** Writes settings in the given order. */
  putSettings(entries: [key: string, value: number][]): void;
  addAuditEvent(e: AuditEvent): void;
  auditEvents(filter: AuditFilter, limit: number, offset: number): unknown[];
  lastAuditId(): number;
  /** The time of the newest audit event of `actor` with `action`, if any. */
  lastAuditTime(actor: string, action: string): number | undefined;
  countAuditEvents(filter: AuditFilter): number;
  /**
   * Drops audit events, error events and the old activity sums (#232: they
   * are no longer written) older than `cutoff`. The play time of #232 is
   * kept until the round is deleted and is not touched.
   */
  purge(cutoff: number, day: number): void;
  suspension(uid: string, now: number): Suspension | undefined;
  suspend(uid: string, reason: string, until: number | null): void;
  unsuspend(uid: string): void;
}

const EVENT_WHERE = `
    WHERE e.id < @before AND e.time BETWEEN @since AND @until
      AND (@player = '' OR e.actor = @player OR e.target = @player)
      AND (@action = '' OR e.action = @action)
      AND (@requestId = '' OR e.request_id = @requestId)
      AND (@reference = '' OR json_extract(e.detail, '$.planet') = @reference
        OR json_extract(e.detail, '$.fleet') = @reference
        OR json_extract(e.detail, '$.origin') = @reference)
      AND (@outcome = '' OR e.outcome = @outcome)
`;

class SqliteAdmin implements Admin {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  universe(): Universe {
    const rows = this.db
      .prepare('SELECT key, value FROM settings')
      .all() as Row[];
    const stored = levels(rows, 'key', 'value');
    const out: Record<string, number> = {};
    for (const s of UNIVERSE_SPECS) out[s.key] = stored[s.key] ?? s.def;
    return out as unknown as Universe;
  }

  saveUniverse(u: Universe): void {
    const put = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const s of UNIVERSE_SPECS) put.run(s.key, u[s.key]);
  }

  setting(key: string): number | undefined {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: number } | undefined;
    return row?.value;
  }

  putSettings(entries: [key: string, value: number][]): void {
    const put = this.db.prepare(
      'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const [key, value] of entries) put.run(key, value);
  }

  addAuditEvent(e: AuditEvent): void {
    this.db
      .prepare(
        `
    INSERT INTO audit_events (time, actor, category, action, outcome, target, request_id, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
      )
      .run(
        e.time,
        e.actor,
        e.category,
        e.action,
        e.outcome,
        e.target,
        e.requestId,
        e.detail,
      );
  }

  auditEvents(filter: AuditFilter, limit: number, offset: number): unknown[] {
    return this.db
      .prepare(
        `
    SELECT e.id, e.time, e.actor, u.name AS actorName, e.category, e.action,
           e.outcome, e.target, e.request_id AS requestId, e.detail
    FROM audit_events e LEFT JOIN users u ON u.id = e.actor
    ${EVENT_WHERE}
    ORDER BY e.id DESC LIMIT @limit OFFSET @offset
  `,
      )
      .all({ ...filter, limit, offset });
  }

  lastAuditId(): number {
    const last = this.db
      .prepare('SELECT COALESCE(MAX(id), 0) AS id FROM audit_events')
      .get() as { id: number };
    return last.id;
  }

  lastAuditTime(actor: string, action: string): number | undefined {
    const row = this.db
      .prepare(
        'SELECT MAX(time) AS time FROM audit_events WHERE actor = ? AND action = ?',
      )
      .get(actor, action) as { time: number | null };
    return row.time ?? undefined;
  }

  countAuditEvents(filter: AuditFilter): number {
    const { count } = this.db
      .prepare(
        `
    SELECT COUNT(*) AS count FROM audit_events e ${EVENT_WHERE}
  `,
      )
      .get(filter) as { count: number };
    return count;
  }

  purge(cutoff: number, day: number): void {
    this.db.prepare('DELETE FROM audit_events WHERE time < ?').run(cutoff);
    // The error log of issue #126 is kept as long as the audit log.
    this.db.prepare('DELETE FROM error_events WHERE time < ?').run(cutoff);
    this.db
      .prepare('DELETE FROM player_activity WHERE day + ? <= ?')
      .run(day, cutoff);
  }

  suspension(uid: string, now: number): Suspension | undefined {
    return this.db
      .prepare(
        'SELECT reason, until FROM suspensions WHERE player = ? AND (until IS NULL OR until > ?)',
      )
      .get(uid, now) as Suspension | undefined;
  }

  suspend(uid: string, reason: string, until: number | null): void {
    this.db
      .prepare(
        `
      INSERT INTO suspensions VALUES (?, ?, ?)
      ON CONFLICT(player) DO UPDATE SET reason = excluded.reason, until = excluded.until
    `,
      )
      .run(uid, reason, until);
  }

  unsuspend(uid: string): void {
    this.db.prepare('DELETE FROM suspensions WHERE player = ?').run(uid);
  }
}

/** The `admin` repository on `Ctx`. */
export const repository = {
  key: 'admin',
  make: (db: Db): Admin => new SqliteAdmin(db),
} as const satisfies RepositoryModule;

/** The settings, the audit, the suspensions and the activity are not bound to a round. */
export const roundReset = [
  {
    keeps: ['settings', 'audit_events', 'suspensions', 'player_activity'],
  },
] satisfies readonly RoundReset[];
