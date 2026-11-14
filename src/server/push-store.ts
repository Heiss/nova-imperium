import type { PushTopic } from '../core/push.ts';
import type { Planet } from '../core/types.ts';
import type { Ctx } from './game/context.ts';

/** The view a push opens in the game. */
export type PushKind =
  'buildings' | 'research' | 'shipyard' | 'fleet' | 'messages';

/** A push to queue for every device of a player. */
export interface PushJob {
  /** The view it opens. */
  kind: PushKind;
  /** The kind the player switches on and off (#192). */
  topic: PushTopic;
  /** Unique per event and kind; a second job with the same key is ignored. */
  key: string;
  due: number;
  /** The text of the notification; null shows the title of the view. */
  body?: string | null;
}

export function queuePush(ctx: Ctx, uid: string, job: PushJob): void {
  ctx.db
    .prepare(
      `
    INSERT OR IGNORE INTO push_jobs (endpoint, kind, event_key, due, retry_at, body, topic)
    SELECT endpoint, ?, ?, ?, ?, ?, ? FROM push_subscriptions WHERE user_id = ?
  `,
    )
    .run(job.kind, job.key, job.due, job.due, job.body ?? null, job.topic, uid);
}

/** A push when an order of a planet or the research is finished. */
export const orderPush = (
  kind: 'buildings' | 'research' | 'shipyard',
  key: string,
  due: number,
): PushJob => ({ kind, topic: kind, key, due });

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
  queuePush(ctx, p.owner, orderPush('shipyard', `${p.id}:${end}`, end));
}
