import { isDatabaseBusy } from './db/database.ts';
import type { User } from './db/store.ts';
import { type Ctx, GameError, int, str } from './game/context.ts';

export const DAY = 86400000;
const RETENTION = 30 * DAY;
const IDLE = 5 * 60000;

export interface AuditEntry {
  category: 'account' | 'game' | 'system' | 'admin.read' | 'admin.write';
  action: string;
  actor?: string | null;
  target?: string | null;
  requestId?: string;
  detail?: object;
}

export function record(ctx: Ctx, entry: AuditEntry, outcome = 'ok'): void {
  ctx.store.db
    .prepare(
      `
    INSERT INTO audit_events (time, actor, category, action, outcome, target, request_id, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      ctx.now(),
      entry.actor ?? null,
      entry.category,
      entry.action,
      outcome,
      entry.target ?? null,
      entry.requestId ?? null,
      JSON.stringify(entry.detail ?? {}),
    );
}

/** Successful mutations and their audit entries commit together. */
export function audited<T>(ctx: Ctx, entry: AuditEntry, work: () => T): T {
  try {
    return ctx.store.tx(() => {
      const result = work();
      record(ctx, entry);
      return result;
    });
  } catch (error) {
    if (!isDatabaseBusy(error)) recordFailure(ctx, entry, error);
    throw error;
  }
}

function recordFailure(ctx: Ctx, entry: AuditEntry, error: unknown): void {
  try {
    record(ctx, entry, error instanceof GameError ? 'rejected' : 'error');
  } catch (auditError) {
    // A busy audit write must not turn a rejected action into a retry.
    if (!isDatabaseBusy(auditError)) throw auditError;
  }
}

export function auditFilter(body: Record<string, unknown>, now: number) {
  return {
    player: str(body.player, 40),
    action: str(body.action, 40),
    requestId: str(body.requestId, 36),
    reference: str(body.reference, 40),
    outcome: str(body.outcome, 16),
    since: Math.max(now - RETENTION, int(body.since, 0, now)),
    until: body.until ? int(body.until, 0, now) : now,
    before: body.before
      ? int(body.before, 1, Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER,
  };
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

export function events(
  ctx: Ctx,
  filter: ReturnType<typeof auditFilter>,
  limit = 51,
  offset = 0,
) {
  return ctx.store.db
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

export function auditPage(ctx: Ctx, body: Record<string, unknown>) {
  const filter = auditFilter(body, ctx.now());
  const last = ctx.store.db
    .prepare('SELECT COALESCE(MAX(id), 0) AS id FROM audit_events')
    .get() as { id: number };
  filter.before = Math.min(filter.before, last.id + 1);
  const size = Number(body.limit);
  const limit = [10, 25, 50, 100].includes(size) ? size : 10;
  const { count } = ctx.store.db
    .prepare(
      `
    SELECT COUNT(*) AS count FROM audit_events e ${EVENT_WHERE}
  `,
    )
    .get(filter) as { count: number };
  const pages = Math.max(1, Math.ceil(count / limit));
  const page = int(body.page, 1, pages);
  return {
    filter,
    result: {
      events: events(ctx, filter, limit, (page - 1) * limit),
      page,
      pages,
      count,
      limit,
      before: filter.before,
    },
  };
}

/** Count gaps between real interactions, excluding gaps above the idle limit. */
export function activity(ctx: Ctx, user: User): void {
  const now = ctx.now();
  const day = Math.floor(now / DAY) * DAY;
  const db = ctx.store.db;
  ctx.store.tx(() => {
    const previous = db
      .prepare(
        `
      SELECT last_seen AS last FROM player_activity WHERE player = ? ORDER BY day DESC LIMIT 1
    `,
      )
      .get(user.id) as { last: number } | undefined;
    const last = previous?.last ?? now;
    if (previous && now - last < 10000) return;
    const start = now - last <= IDLE ? last : now;
    if (start < day) {
      db.prepare(
        'UPDATE player_activity SET active_ms = active_ms + ? WHERE player = ? AND day = ?',
      ).run(day - start, user.id, day - DAY);
    }
    db.prepare(
      `
      INSERT INTO player_activity VALUES (?, ?, ?, ?)
      ON CONFLICT(player, day) DO UPDATE SET last_seen = excluded.last_seen,
        active_ms = player_activity.active_ms + excluded.active_ms
    `,
    ).run(user.id, day, now, now - Math.max(start, day));
  });
}

export function purgeAudit(ctx: Ctx): void {
  const cutoff = ctx.now() - RETENTION;
  ctx.store.db.prepare('DELETE FROM audit_events WHERE time < ?').run(cutoff);
  ctx.store.db
    .prepare('DELETE FROM player_activity WHERE day + ? <= ?')
    .run(DAY, cutoff);
}
