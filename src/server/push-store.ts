import type { Planet } from '../core/types.ts';
import type { Ctx } from './game/context.ts';

export type PushKind =
  'buildings' | 'research' | 'shipyard' | 'fleet' | 'messages';

export function queuePush(
  ctx: Ctx,
  uid: string,
  kind: PushKind,
  key: string,
  due: number,
  body: string | null = null,
): void {
  ctx.db
    .prepare(
      `
    INSERT OR IGNORE INTO push_jobs (endpoint, kind, event_key, due, retry_at, body)
    SELECT endpoint, ?, ?, ?, ?, ? FROM push_subscriptions WHERE user_id = ?
  `,
    )
    .run(kind, key, due, due, body, uid);
}

export function cancelScheduledPush(
  ctx: Ctx,
  uid: string,
  kind: PushKind,
  keyPattern: string | null = null,
): void {
  ctx.db
    .prepare(
      `
    DELETE FROM push_jobs WHERE kind = ? AND due > ?
    AND (? IS NULL OR event_key GLOB ?)
    AND endpoint IN (SELECT endpoint FROM push_subscriptions WHERE user_id = ?)
  `,
    )
    .run(kind, ctx.now(), keyPattern, keyPattern, uid);
}

export function scheduleShipyard(ctx: Ctx, p: Planet): void {
  if (p.sqT === null) return;
  const end = p.sq.reduce((time, item) => time + item.unit * item.n, p.sqT);
  cancelScheduledPush(ctx, p.owner, 'shipyard', `${p.id}:*`);
  queuePush(ctx, p.owner, 'shipyard', `${p.id}:${end}`, end);
}
