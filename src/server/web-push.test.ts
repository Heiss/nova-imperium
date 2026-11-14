import { describe, expect, it, vi } from 'vitest';
import { PUSH_TOPICS, type PushTopic } from '../core/push.ts';
import { build, cancelBuild, order, research } from './game/actions.ts';
import { announce } from './game/admin.ts';
import { addReport } from './game/context.ts';
import { pushOptions } from './push-options.ts';
import { queuePush } from './push-store.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
  type TestCtx,
} from './test-helpers.ts';
import {
  deletePushSubscription,
  deliverPush,
  savePushSubscription,
  vapidKeys,
} from './web-push.ts';

const endpoint = 'https://fcm.googleapis.com/fcm/send/example';
const keys = {
  p256dh: Buffer.alloc(65, 4).toString('base64url'),
  auth: Buffer.alloc(16, 3).toString('base64url'),
};

describe('Web Push', () => {
  it('stores a stable push identity and refuses untrusted URLs and other accounts', () => {
    const ctx = testCtx();
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Ben');
    expect(vapidKeys(ctx).publicKey).toHaveLength(87);
    expect(vapidKeys(ctx)).toEqual(vapidKeys(ctx));
    for (const value of [
      'https://127.0.0.1/',
      'http://fcm.googleapis.com/',
      'https://fcm.googleapis.com.evil.org/',
      'https://x@fcm.googleapis.com/',
    ])
      expect(() =>
        savePushSubscription(ctx, a.id, { endpoint: value, keys }),
      ).toThrow();
    expect(() =>
      savePushSubscription(ctx, a.id, { endpoint, keys: {} }),
    ).toThrow('Push-Schlüssel');
    savePushSubscription(ctx, a.id, { endpoint, keys });
    expect(() => savePushSubscription(ctx, b.id, { endpoint, keys })).toThrow(
      'anderen Konto',
    );
    deletePushSubscription(ctx, b.id, endpoint);
    expect(
      ctx.db.prepare('SELECT * FROM push_subscriptions').all(),
    ).toHaveLength(1);
    deletePushSubscription(ctx, a.id, endpoint);
    expect(ctx.db.prepare('SELECT * FROM push_subscriptions').all()).toEqual(
      [],
    );
  });

  it('sends due work only once and does not notify for cancelled work', async () => {
    const ctx = testCtx();
    const user = addUser(ctx, 'Anna');
    addPlanet(ctx, user.id);
    savePushSubscription(ctx, user.id, { endpoint, keys });
    build(ctx, user, { key: 'metal' });
    const send = vi.fn(async () => {});
    await deliverPush(ctx, send);
    expect(send).not.toHaveBeenCalled();
    cancelBuild(ctx, user, {});
    build(ctx, user, { key: 'solar' });
    ctx.clock.t = ctx.planets.home(user.id)!.bq!.end + 1;
    await deliverPush(ctx, send);
    await deliverPush(ctx, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint }),
      expect.stringContaining('Das Werk ist vollbracht'),
    );
  });

  it('delivers the text of a server announcement to subscribed devices only', async () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const ben = addUser(ctx, 'Ben');
    savePushSubscription(ctx, anna.id, { endpoint, keys });
    expect(announce(ctx, 'Wartung heute Abend')).toBe(2);
    for (const user of [anna, ben]) {
      expect(ctx.reports.ofPlayer(user.id)).toMatchObject([
        { title: 'Servernachricht', text: 'Wartung heute Abend' },
      ]);
    }
    const send = vi.fn(async () => {});
    await deliverPush(ctx, send);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint }),
      expect.stringContaining('Servernachricht: Wartung heute Abend'),
    );
  });

  it('queues reports, retries transient errors and drops expired subscriptions', async () => {
    const ctx = testCtx();
    const user = addUser(ctx, 'Anna');
    savePushSubscription(ctx, user.id, { endpoint, keys });
    addReport(
      ctx,
      user.id,
      { time: ctx.now(), type: 'battle', title: 'Private coordinates' },
      { topic: 'attacked' },
    );
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockRejectedValueOnce({ statusCode: 410 });
    await deliverPush(ctx, send);
    expect(send.mock.calls[0]![1]).toContain('Neue Nachricht');
    expect(send.mock.calls[0]![1]).not.toContain('Private coordinates');
    await deliverPush(ctx, send);
    expect(send).toHaveBeenCalledTimes(1);
    ctx.clock.t += 30_000;
    await deliverPush(ctx, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(ctx.db.prepare('SELECT * FROM push_subscriptions').all()).toEqual(
      [],
    );
    expect(ctx.db.prepare('SELECT * FROM push_jobs').all()).toEqual([]);
  });
});

describe('push kinds of the player (#192)', () => {
  /** Sends nothing; returns the endpoint and the title of every push. */
  const recorder = () => {
    const sent: { endpoint: string; title: string; view: string }[] = [];
    const send = vi.fn(async (job: { endpoint: string }, payload: string) => {
      const { title, view } = JSON.parse(payload) as {
        title: string;
        view: string;
      };
      sent.push({ endpoint: job.endpoint, title, view });
    });
    return { sent, send };
  };

  const push = (ctx: TestCtx, uid: string, topic: PushTopic, key: string) =>
    queuePush(ctx, uid, { kind: 'messages', topic, key, due: ctx.now() });

  it.each(PUSH_TOPICS)(
    'drops „%s“ on every device of a player who switched it off; the others arrive',
    async (topic) => {
      const ctx = testCtx();
      const anna = addUser(ctx, 'Anna');
      const ben = addUser(ctx, 'Ben');
      const phone = subscribePush(ctx, anna.id, 1);
      const laptop = subscribePush(ctx, anna.id, 2);
      const bens = subscribePush(ctx, ben.id);
      const other = PUSH_TOPICS.find((t) => t !== topic)!;
      expect(pushOptions(ctx, anna, { off: [topic] })).toBe('Gespeichert.');
      push(ctx, anna.id, topic, 'a1');
      push(ctx, anna.id, other, 'a2');
      push(ctx, ben.id, topic, 'b1');
      const off = recorder();
      await deliverPush(ctx, off.send);
      expect(off.sent.map((x) => x.endpoint).sort()).toEqual(
        [phone, laptop, bens].sort(),
      );
      expect(queuedPushes(ctx)).toEqual([]);
      pushOptions(ctx, anna, { off: [] });
      push(ctx, anna.id, topic, 'a3');
      const on = recorder();
      await deliverPush(ctx, on.send);
      expect(on.sent.map((x) => x.endpoint).sort()).toEqual(
        [phone, laptop].sort(),
      );
    },
  );

  it('checks the switch when the push is due, not when it is queued', async () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id);
    subscribePush(ctx, anna.id);
    build(ctx, anna, { key: 'metal' });
    pushOptions(ctx, anna, { off: ['buildings'] });
    const end = ctx.planets.home(anna.id)!.bq!.end;
    const early = recorder();
    await deliverPush(ctx, early.send);
    expect(queuedPushes(ctx)).toEqual([
      { user: anna.id, kind: 'buildings', topic: 'buildings' },
    ]);
    pushOptions(ctx, anna, { off: [] });
    ctx.clock.t = end;
    const due = recorder();
    await deliverPush(ctx, due.send);
    expect(due.sent).toMatchObject([
      { title: 'Das Werk ist vollbracht', view: 'buildings' },
    ]);
    build(ctx, anna, { key: 'metal' });
    pushOptions(ctx, anna, { off: ['buildings'] });
    ctx.clock.t = ctx.planets.home(anna.id)!.bq!.end;
    const muted = recorder();
    await deliverPush(ctx, muted.send);
    expect(muted.sent).toEqual([]);
    expect(queuedPushes(ctx)).toEqual([]);
  });

  it('keeps a push that is not due yet and a push without a kind', async () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const endpoint = subscribePush(ctx, anna.id);
    pushOptions(ctx, anna, { off: [...PUSH_TOPICS] });
    queuePush(ctx, anna.id, {
      kind: 'research',
      topic: 'research',
      key: 'later',
      due: ctx.now() + 1,
    });
    // A report push queued before the upgrade to migration 16 has no kind.
    ctx.db
      .prepare(
        "INSERT INTO push_jobs (endpoint, kind, event_key, due, retry_at) VALUES (?, 'messages', 'old', ?, ?)",
      )
      .run(endpoint, ctx.now(), ctx.now());
    const { sent, send } = recorder();
    await deliverPush(ctx, send);
    expect(sent).toMatchObject([{ title: 'Neue Nachricht' }]);
    expect(queuedPushes(ctx)).toEqual([
      { user: anna.id, kind: 'research', topic: 'research' },
    ]);
  });

  it('gives the orders, the research and a server announcement their kinds', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { b: { lab: 1, yard: 1 } });
    subscribePush(ctx, anna.id);
    build(ctx, anna, { key: 'metal' });
    research(ctx, anna, { key: 'energy' });
    order(ctx, anna, { key: 'rl', n: 1 });
    announce(ctx, 'Wartung');
    expect(queuedPushes(ctx).map((x) => [x.kind, x.topic])).toEqual([
      ['buildings', 'buildings'],
      ['research', 'research'],
      ['shipyard', 'shipyard'],
      ['messages', 'announcement'],
    ]);
  });

  it('gives the orders a new device schedules their kinds', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    addPlanet(ctx, anna.id, { b: { lab: 1, yard: 1 } });
    build(ctx, anna, { key: 'metal' });
    research(ctx, anna, { key: 'energy' });
    order(ctx, anna, { key: 'rl', n: 1 });
    savePushSubscription(ctx, anna.id, { endpoint, keys });
    expect(queuedPushes(ctx).map((x) => [x.kind, x.topic])).toEqual([
      ['research', 'research'],
      ['buildings', 'buildings'],
      ['shipyard', 'shipyard'],
    ]);
  });
});
