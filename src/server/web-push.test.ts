import { describe, expect, it, vi } from 'vitest';
import { build, cancelBuild } from './game/actions.ts';
import { announce } from './game/admin.ts';
import { addReport } from './game/context.ts';
import { addPlanet, addUser, testCtx } from './test-helpers.ts';
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
    addReport(ctx, user.id, {
      time: ctx.now(),
      type: 'battle',
      title: 'Private coordinates',
    });
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
