import { createHash } from 'node:crypto';
import { generateVAPIDKeys, sendNotification } from 'web-push';
import { settle } from '../shared/settle.ts';
import { fail, universe, type Ctx } from './game/context.ts';
import { queuePush, scheduleShipyard, type PushKind } from './push-store.ts';

const TITLES: Record<PushKind, string> = {
  buildings: 'Ausbau abgeschlossen',
  research: 'Forschung abgeschlossen',
  shipyard: 'Werftauftrag abgeschlossen',
  fleet: 'Flottenereignis',
  messages: 'Neue Nachricht',
};
const TTL = 3600;
const MAX_ATTEMPTS = 4;

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Job extends Subscription {
  kind: PushKind;
  event_key: string;
  due: number;
  attempts: number;
  body: string | null;
}

function supportedHost(host: string): boolean {
  return (
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.notify.windows.com')
  );
}

function allowedEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    return fail('Ungültige Push-Adresse.');
  const url = URL.parse(value);
  if (
    url?.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    return fail('Ungültige Push-Adresse.');
  if (!supportedHost(url.hostname))
    return fail('Dieser Push-Dienst wird nicht unterstützt.');
  return url.href;
}

function subscriptionKey(value: unknown, length: number): string {
  if (
    typeof value !== 'string' ||
    !/^[\w-]+$/.test(value) ||
    Buffer.from(value, 'base64url').length !== length
  )
    return fail('Ungültiger Push-Schlüssel.');
  return value;
}

export function savePushSubscription(
  ctx: Ctx,
  uid: string,
  body: Record<string, unknown>,
): void {
  const endpoint = allowedEndpoint(body.endpoint);
  const keys = body.keys as Record<string, unknown> | undefined;
  const p256dh = subscriptionKey(keys?.p256dh, 65);
  const auth = subscriptionKey(keys?.auth, 16);
  ctx.store.tx(() => {
    const db = ctx.store.db;
    const count = db
      .prepare(
        'SELECT count(*) AS n FROM push_subscriptions WHERE user_id = ? AND endpoint != ?',
      )
      .get(uid, endpoint) as { n: number };
    if (count.n >= 10) fail('Zu viele Geräte für dieses Konto.');
    const changed = db
      .prepare(
        `
    INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
      WHERE user_id = excluded.user_id
  `,
      )
      .run(endpoint, uid, p256dh, auth);
    if (!changed.changes)
      fail('Diese Push-Anmeldung gehört zu einem anderen Konto.');
    scheduleCurrentOrders(ctx, uid);
  });
}

function scheduleCurrentOrders(ctx: Ctx, uid: string): void {
  const now = ctx.now();
  const planet = ctx.store.planetOfUser(uid);
  const research = ctx.store.user(uid)?.rq;
  if (research && research.end > now)
    queuePush(ctx, uid, 'research', String(research.start), research.end);
  if (!planet) return;
  const p = settle(planet, now, universe(ctx));
  if (p.bq) queuePush(ctx, uid, 'buildings', String(p.bq.start), p.bq.end);
  if (p.sqT !== null) scheduleShipyard(ctx, uid, p.sqT, p.sq);
}

export function deletePushSubscription(
  ctx: Ctx,
  uid: string,
  endpoint: unknown,
): void {
  ctx.store.db
    .prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
    )
    .run(allowedEndpoint(endpoint), uid);
}

export function vapidKeys(ctx: Ctx): { publicKey: string; privateKey: string } {
  const db = ctx.store.db;
  return ctx.store.tx(() => {
    const existing = db
      .prepare(
        'SELECT public_key AS publicKey, private_key AS privateKey FROM push_keys WHERE id = 1',
      )
      .get() as { publicKey: string; privateKey: string } | undefined;
    if (existing) return existing;
    const keys = generateVAPIDKeys();
    db.prepare('INSERT INTO push_keys VALUES (1, ?, ?)').run(
      keys.publicKey,
      keys.privateKey,
    );
    return keys;
  });
}

function pending(ctx: Ctx, now: number): Job[] {
  ctx.store.db
    .prepare('DELETE FROM push_jobs WHERE due <= ?')
    .run(now - TTL * 1000);
  return ctx.store.db
    .prepare(
      `
    SELECT j.*, s.p256dh, s.auth FROM push_jobs j
    JOIN push_subscriptions s USING (endpoint)
    WHERE j.retry_at <= ? ORDER BY j.retry_at LIMIT 20
  `,
    )
    .all(now) as Job[];
}

function discard(ctx: Ctx, job: Job): void {
  ctx.store.db
    .prepare(
      'DELETE FROM push_jobs WHERE endpoint = ? AND kind = ? AND event_key = ?',
    )
    .run(job.endpoint, job.kind, job.event_key);
}

function retry(ctx: Ctx, job: Job, error: unknown): void {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  if (status === 404 || status === 410) {
    ctx.store.db
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
      .run(job.endpoint);
  } else if (
    job.attempts + 1 >= MAX_ATTEMPTS ||
    (status && status >= 400 && status < 500 && status !== 429)
  ) {
    discard(ctx, job);
  } else {
    ctx.store.db
      .prepare(
        `
      UPDATE push_jobs SET attempts = attempts + 1, retry_at = ?
      WHERE endpoint = ? AND kind = ? AND event_key = ?
    `,
      )
      .run(
        ctx.now() + 30_000 * 2 ** job.attempts,
        job.endpoint,
        job.kind,
        job.event_key,
      );
  }
}

type SendPush = (job: Subscription, payload: string) => Promise<unknown>;

export function pushSender(ctx: Ctx, subject: string): SendPush {
  const vapidDetails = { subject, ...vapidKeys(ctx) };
  return (job, payload) =>
    sendNotification(
      {
        endpoint: allowedEndpoint(job.endpoint),
        keys: { p256dh: job.p256dh, auth: job.auth },
      },
      payload,
      { vapidDetails, TTL, timeout: 5000 },
    );
}

export async function deliverPush(ctx: Ctx, send: SendPush): Promise<void> {
  for (const job of pending(ctx, ctx.now())) {
    const tag = createHash('sha256')
      .update(`${job.kind}:${job.event_key}`)
      .digest('hex');
    try {
      await send(
        job,
        JSON.stringify({
          title: job.body ?? TITLES[job.kind],
          view: job.kind,
          tag,
        }),
      );
      discard(ctx, job);
    } catch (error) {
      retry(ctx, job, error);
    }
  }
}

export function startPushDelivery(
  ctx: Ctx,
  subject: string,
  onFailure: () => void,
): () => Promise<void> {
  const send = pushSender(ctx, subject);
  let pending: Promise<void> | null = null;
  const timer = setInterval(() => {
    pending ??= deliverPush(ctx, send)
      .catch(onFailure)
      .finally(() => {
        pending = null;
      });
  }, 5000);
  return async () => {
    clearInterval(timer);
    await pending;
  };
}
