import { DAY, type AuditEntry } from '../audit.ts';
import type { User } from '../db/store.ts';
import { type Ctx, fail, str } from './context.ts';

export function suspension(ctx: Ctx, uid: string) {
  return ctx.store.db
    .prepare(
      'SELECT reason, until FROM suspensions WHERE player = ? AND (until IS NULL OR until > ?)',
    )
    .get(uid, ctx.now()) as
    { reason: string; until: number | null } | undefined;
}

export function ensureActive(ctx: Ctx, uid: string): void {
  if (suspension(ctx, uid)) fail('Dieses Konto ist gesperrt.');
}

export function moderate(
  ctx: Ctx,
  admin: User,
  body: Record<string, unknown>,
  entry: AuditEntry,
): void {
  const target =
    ctx.store.user(str(body.player, 40)) ?? fail('Spieler nicht gefunden.');
  if (target.id === admin.id || target.admin)
    fail('Dieses Konto kann nur auf dem Server verwaltet werden.');
  const reason = str(body.reason, 200);
  if (!reason) fail('Bitte einen Grund angeben.');
  const before = suspension(ctx, target.id) ?? null;
  const sessions = updateAccess(
    ctx,
    target.id,
    entry.action,
    reason,
    body.hours,
  );
  entry.detail = {
    reason,
    before,
    after: suspension(ctx, target.id) ?? null,
    sessions,
  };
}

function updateAccess(
  ctx: Ctx,
  player: string,
  action: string,
  reason: string,
  duration: unknown,
): number {
  const db = ctx.store.db;
  if (action === 'unban') {
    db.prepare('DELETE FROM suspensions WHERE player = ?').run(player);
    return 0;
  }
  if (action === 'ban') {
    const hours = Number(duration ?? 0);
    if (!Number.isInteger(hours) || hours < 0 || hours > 720)
      fail('Sperrdauer: 0 bis 720 Stunden.');
    const until = hours ? ctx.now() + (hours * DAY) / 24 : null;
    db.prepare(
      `
      INSERT INTO suspensions VALUES (?, ?, ?)
      ON CONFLICT(player) DO UPDATE SET reason = excluded.reason, until = excluded.until
    `,
    ).run(player, reason, until);
  }
  db.prepare(
    "DELETE FROM account_tokens WHERE user_id = ? AND purpose = 'login'",
  ).run(player);
  return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(player)
    .changes;
}
