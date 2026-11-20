// The rate limit per account for game actions and play time reports (#328,
// #232): one counter for both.
import { record } from '../audit.ts';
import { isDatabaseBusy } from '../db/database.ts';
import type { User } from '../db/repos/players.ts';
import { type Ctx, fail } from '../game/context.ts';
import { RateLimiter } from './rate-limit.ts';

/**
 * At most 120 actions and play time reports together per account and minute
 * (owner, 2026-11-19, #328, #232). A fixed value, no round setting: the owner
 * chose it. The window is the one of
 * `RateLimiter`: fixed, it starts with the first action and ends a minute
 * later.
 */
export const ACTIONS_PER_MINUTE = 120;
const WINDOW_MS = 60000;
/** The audit log hears of a limited account at most once per hour (owner, 2026-11-19, #328). */
const AUDIT_EVERY_MS = 3600000;
/** The action name of the audit entry; the admin finds it under „Abgelehnt“. */
const LIMIT_AUDIT_ACTION = 'rateLimit';
// [V] Wording of the issue.
const REFUSAL = 'Zu viele Aktionen in kurzer Zeit. Bitte warte einen Moment.';

export interface ActionLimit {
  /** Counts one action or report of `u` and refuses it above the limit. */
  check(u: User, requestId: string): void;
  sweep(): void;
}

export function actionLimit(ctx: Ctx): ActionLimit {
  const counts = new RateLimiter(ACTIONS_PER_MINUTE, WINDOW_MS, ctx.now);
  // When the audit log last heard of an account. A miss asks the audit log
  // once, so the hour holds across a restart.
  const noted = new Map<string, number>();
  const lastNote = (id: string): number | undefined => {
    if (noted.has(id)) return noted.get(id);
    const t = ctx.admin.lastAuditTime(id, LIMIT_AUDIT_ACTION);
    if (t !== undefined) noted.set(id, t);
    return t;
  };
  const note = (u: User, requestId: string): void => {
    const t = ctx.now();
    // Never noted: infinitely long ago.
    const last = lastNote(u.id) ?? -Infinity;
    if (t - last < AUDIT_EVERY_MS) return;
    try {
      record(
        ctx,
        {
          category: 'game',
          action: LIMIT_AUDIT_ACTION,
          actor: u.id,
          requestId,
          detail: {
            limit: ACTIONS_PER_MINUTE,
            windowSeconds: WINDOW_MS / 1000,
          },
        },
        'rejected',
      );
      noted.set(u.id, t);
    } catch (error) {
      // A busy log must not turn the refusal into a retry; the next
      // refusal writes the entry.
      if (!isDatabaseBusy(error)) throw error;
    }
  };
  return {
    check(u, requestId) {
      if (!counts.limited(u.id)) return;
      note(u, requestId);
      fail(REFUSAL);
    },
    sweep() {
      counts.sweep();
      const t = ctx.now();
      for (const [id, at] of noted)
        if (t - at >= AUDIT_EVERY_MS) noted.delete(id);
    },
  };
}
