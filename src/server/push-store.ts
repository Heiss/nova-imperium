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
  ctx.store.db
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
): void {
  ctx.store.db
    .prepare(
      `
    DELETE FROM push_jobs WHERE kind = ? AND due > ?
    AND endpoint IN (SELECT endpoint FROM push_subscriptions WHERE user_id = ?)
  `,
    )
    .run(kind, ctx.now(), uid);
}

export function scheduleShipyard(
  ctx: Ctx,
  uid: string,
  start: number,
  queue: { unit: number; n: number }[],
): void {
  const end = queue.reduce((time, item) => time + item.unit * item.n, start);
  cancelScheduledPush(ctx, uid, 'shipyard');
  queuePush(ctx, uid, 'shipyard', String(end), end);
}
