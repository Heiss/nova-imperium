// Admin data (#117): the settings of the universe and the round, the audit
// log, player activity, suspensions and the retention of the error log.
// The error log itself is still raw SQL in error-log.ts until a follow-up.
import { DEFAULT_UNIVERSE, UNIVERSE_SPECS } from '../../../core/universe.ts';
import type { Universe } from '../../../core/types.ts';
import type { Db } from '../database.ts';
import { levels, type Row } from './rows.ts';

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

export interface Suspension {
  reason: string;
  until: number | null;
}

export interface Admin {
  universe(): Universe;
  saveUniverse(u: Universe): void;
  /** The stored settings of the round (`round`, `roundAchievements`, `roundDaily`). */
  roundSettings(): { key: string; value: number }[];
  /** Writes settings in the given order. */
  putSettings(entries: [key: string, value: number][]): void;
  addAuditEvent(e: AuditEvent): void;
  auditEvents(filter: AuditFilter, limit: number, offset: number): unknown[];
  lastAuditId(): number;
  countAuditEvents(filter: AuditFilter): number;
  /** The last interaction of a player, on their newest day. */
  lastActivity(uid: string): { last: number } | undefined;
  addActiveTime(ms: number, uid: string, day: number): void;
  touchActivity(uid: string, day: number, now: number, ms: number): void;
  /** Drops audit events, error events and activity older than `cutoff`. */
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

export class SqliteAdmin implements Admin {
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
    for (const s of UNIVERSE_SPECS)
      out[s.key] = stored[s.key] ?? DEFAULT_UNIVERSE[s.key];
    return out as unknown as Universe;
  }

  saveUniverse(u: Universe): void {
    const put = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const s of UNIVERSE_SPECS) put.run(s.key, u[s.key]);
  }

  roundSettings(): { key: string; value: number }[] {
    return this.db
      .prepare(
        "SELECT key, value FROM settings WHERE key IN ('round', 'roundAchievements', 'roundDaily')",
      )
      .all() as { key: string; value: number }[];
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

  lastActivity(uid: string): { last: number } | undefined {
    return this.db
      .prepare(
        `
      SELECT last_seen AS last FROM player_activity WHERE player = ? ORDER BY day DESC LIMIT 1
    `,
      )
      .get(uid) as { last: number } | undefined;
  }

  addActiveTime(ms: number, uid: string, day: number): void {
    this.db
      .prepare(
        'UPDATE player_activity SET active_ms = active_ms + ? WHERE player = ? AND day = ?',
      )
      .run(ms, uid, day);
  }

  touchActivity(uid: string, day: number, now: number, ms: number): void {
    this.db
      .prepare(
        `
      INSERT INTO player_activity VALUES (?, ?, ?, ?)
      ON CONFLICT(player, day) DO UPDATE SET last_seen = excluded.last_seen,
        active_ms = player_activity.active_ms + excluded.active_ms
    `,
      )
      .run(uid, day, now, ms);
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
