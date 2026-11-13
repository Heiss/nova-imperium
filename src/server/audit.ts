import { isDatabaseBusy } from './db/database.ts';
import type { AuditFilter } from './db/repos/admin.ts';
import type { User } from './db/repos/players.ts';
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
  ctx.admin.addAuditEvent({
    time: ctx.now(),
    actor: entry.actor ?? null,
    category: entry.category,
    action: entry.action,
    outcome,
    target: entry.target ?? null,
    requestId: entry.requestId ?? null,
    detail: JSON.stringify(entry.detail ?? {}),
  });
}

/** Successful mutations and their audit entries commit together. */
export function audited<T>(ctx: Ctx, entry: AuditEntry, work: () => T): T {
  try {
    return ctx.tx(() => {
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

export function auditFilter(
  body: Record<string, unknown>,
  now: number,
): AuditFilter {
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

export function events(ctx: Ctx, filter: AuditFilter, limit = 51, offset = 0) {
  return ctx.admin.auditEvents(filter, limit, offset);
}

export function auditPage(ctx: Ctx, body: Record<string, unknown>) {
  const filter = auditFilter(body, ctx.now());
  filter.before = Math.min(filter.before, ctx.admin.lastAuditId() + 1);
  const count = ctx.admin.countAuditEvents(filter);
  const { page, pages, limit, offset } = pageWindow(body, count);
  return {
    filter,
    result: {
      events: events(ctx, filter, limit, offset),
      page,
      pages,
      count,
      limit,
      before: filter.before,
    },
  };
}

/** The page sizes of the admin lists: 10, 25, 50 or 100, else 10. */
export function pageWindow(body: Record<string, unknown>, count: number) {
  const size = Number(body.limit);
  const limit = [10, 25, 50, 100].includes(size) ? size : 10;
  const pages = Math.max(1, Math.ceil(count / limit));
  const page = int(body.page, 1, pages);
  return { page, pages, limit, offset: (page - 1) * limit };
}

/** Count gaps between real interactions, excluding gaps above the idle limit. */
export function activity(ctx: Ctx, user: User): void {
  const now = ctx.now();
  const day = Math.floor(now / DAY) * DAY;
  ctx.tx(() => {
    const previous = ctx.admin.lastActivity(user.id);
    const last = previous?.last ?? now;
    if (previous && now - last < 10000) return;
    const start = now - last <= IDLE ? last : now;
    if (start < day) {
      ctx.admin.addActiveTime(day - start, user.id, day - DAY);
    }
    ctx.admin.touchActivity(user.id, day, now, now - Math.max(start, day));
  });
}

export function purgeAudit(ctx: Ctx): void {
  ctx.admin.purge(ctx.now() - RETENTION, DAY);
}
