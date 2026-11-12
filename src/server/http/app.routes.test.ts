// Routes of app.ts that the flow tests in app.test.ts leave open: answers
// and headers, the rate limit of every guarded route, mails for login codes
// and resets, passkey routes (WebAuthn check replaced) and invitations.
import * as webauthn from '@simplewebauthn/server';
import { describe, expect, it, vi } from 'vitest';
import { createInvitation } from '../auth.ts';
import type { Mail } from '../mail.ts';
import { addPlanet, addUser } from '../test-helpers.ts';
import { asAdmin, start } from '../../test/http.ts';
import { COOKIE } from './app.ts';

vi.mock('@simplewebauthn/server', async (original) => ({
  ...(await original<typeof import('@simplewebauthn/server')>()),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

const tick = () => new Promise((r) => setImmediate(r));
const SIGNED_OUT = `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;

async function player(over: Parameters<typeof start>[0] = {}) {
  const s = await start(over);
  addUser(s.ctx, 'Anna');
  addPlanet(s.ctx, 'u_Anna');
  return s;
}

describe('answers', () => {
  it('sends JSON uncached with a request id, files with revalidation', async () => {
    const { call } = await start();
    const health = await call('GET', '/healthz');
    expect(health.json).toEqual({ ok: true });
    expect(health.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    expect(health.headers.get('cache-control')).toBe('no-store');
    expect(health.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const page = await call('GET', '/');
    expect(page.headers.get('cache-control')).toBe('no-cache');
    expect(page.headers.get('x-request-id')).toBeNull();
    expect((await call('GET', '/api/nothing')).json).toEqual({
      error: 'Nicht gefunden.',
    });
    expect((await call('PUT', '/index.html')).status).toBe(405);
    expect((await call('HEAD', '/')).status).toBe(200);
  });

  it('remembers a login unless asked not to, and signs out with an empty cookie', async () => {
    const { call } = await player({ cfg: { sessionDays: 2 } });
    const login = (remember?: boolean) =>
      call('POST', '/api/login', {
        name: 'Anna',
        password: 'secret1',
        remember,
      });
    expect((await login()).set).toMatch(/; Max-Age=172800$/);
    expect((await login(true)).set).toMatch(/; Max-Age=172800$/);
    const session = (await login(false)).set!;
    expect(session).not.toContain('Max-Age');
    expect(session).toMatch(
      new RegExp(`^${COOKIE}=[\\w-]{43}; HttpOnly; Path=/; SameSite=Lax$`),
    );
    const out = await call('POST', '/api/logout', {});
    expect(out.json).toEqual({ ok: true });
    expect(out.set).toBe(SIGNED_OUT);
  });
});

describe('rate limit', () => {
  it('guards every route that takes a secret or creates something', async () => {
    const guarded = [
      '/api/invite/check',
      '/api/register',
      '/api/login',
      '/api/login/code',
      '/api/password/forgot',
      '/api/password/reset',
      '/api/password/change',
      '/api/account/delete',
      '/api/passkeys/register/options',
      '/api/passkeys/register',
      '/api/passkeys/login/options',
      '/api/passkeys/login',
    ];
    for (const url of guarded) {
      const { call } = await start({ cfg: { rateLimitAttempts: 0 } });
      expect({ url, json: (await call('POST', url, {})).json }).toEqual({
        url,
        json: { error: 'Zu viele Versuche – bitte später nochmal.' },
      });
    }
  });
});

describe('mails', () => {
  it('sends a reset link in the background, and says when mail is off', async () => {
    const mails: Mail[] = [];
    const logs: string[] = [];
    const off = await player();
    expect(
      (await off.call('POST', '/api/password/forgot', { email: 'x' })).json,
    ).toEqual({
      error: 'Passwort-Wiederherstellung per E-Mail ist nicht eingerichtet.',
    });
    const { call } = await player({
      mailer: async (m) => void mails.push(m),
      logs,
    });
    const asked = await call('POST', '/api/password/forgot', {
      email: 'anna@example.org',
    });
    expect(asked.json).toEqual({ ok: true });
    await tick();
    expect(mails).toEqual([
      {
        to: 'anna@example.org',
        subject: 'Passwort für Nova Imperium zurücksetzen',
        text: expect.stringMatching(
          /^Neues Passwort festlegen: http:\/\/localhost:8080\/#reset=[\w-]{43}\n\nDer Link gilt einmal und für 30 Minuten\./,
        ),
      },
    ]);
    await call('POST', '/api/password/forgot', { email: 'nobody@example.org' });
    await tick();
    expect(mails).toHaveLength(1);
    expect(logs).toEqual([]);
  });

  it('logs a reset mail that fails', async () => {
    const logs: string[] = [];
    const { call } = await player({
      mailer: () => Promise.reject(new Error('smtp down')),
      logs,
    });
    expect(
      (
        await call('POST', '/api/password/forgot', {
          email: 'anna@example.org',
        })
      ).json,
    ).toEqual({ ok: true });
    await tick();
    await tick();
    expect(logs).toEqual(['Password reset mail failed']);
  });

  it('mails a login code, or names why it cannot', async () => {
    const mails: Mail[] = [];
    const codes = { cfg: { emailLoginCodes: true } };
    const login = { name: 'Anna', password: 'secret1' };
    const noMail = await player(codes);
    expect((await noMail.call('POST', '/api/login', login)).json).toEqual({
      error: 'Anmeldecodes sind momentan nicht verfügbar.',
    });
    const failing = await player({
      ...codes,
      mailer: () => Promise.reject(new Error('down')),
    });
    expect((await failing.call('POST', '/api/login', login)).json).toEqual({
      error: 'Der Anmeldecode konnte nicht gesendet werden.',
    });
    const { ctx, call } = await player({
      ...codes,
      mailer: async (m) => void mails.push(m),
    });
    addUser(ctx, 'Nomail', { email: null });
    expect(
      (await call('POST', '/api/login', { ...login, name: 'Nomail' })).json,
    ).toEqual({
      error: 'Für dieses Konto ist keine E-Mail-Adresse hinterlegt.',
    });
    const sent = await call('POST', '/api/login', login);
    expect(sent.json).toEqual({ challenge: expect.any(String) });
    expect(sent.set).toBeNull();
    expect(mails).toEqual([
      {
        to: 'anna@example.org',
        subject: 'Dein Anmeldecode für Nova Imperium',
        text: expect.stringMatching(
          /^Dein Anmeldecode lautet \d{6}\. Er gilt einmal und für zehn Minuten\.$/,
        ),
      },
    ]);
  });

  it('refuses login codes when they are off', async () => {
    const { call } = await player();
    expect((await call('POST', '/api/login/code', {})).json).toEqual({
      error: 'Anmeldecodes sind nicht aktiviert.',
    });
  });
});

describe('invitations', () => {
  it('returns the link to copy without SMTP and logs a failed mail', async () => {
    const off = await asAdmin();
    expect(
      (await off.call('POST', '/api/admin/invite', { email: 'a@example.org' }))
        .json,
    ).toMatchObject({
      ok: true,
      mailed: false,
      msg: 'Kein SMTP eingerichtet: bitte den Link selbst weitergeben.',
    });
    const logs: string[] = [];
    const failing = await asAdmin({
      mailer: () => Promise.reject(new Error('down')),
      logs,
    });
    expect(
      (
        await failing.call('POST', '/api/admin/invite', {
          email: 'b@example.org',
        })
      ).json,
    ).toMatchObject({
      mailed: false,
      msg: 'Die Mail konnte nicht gesendet werden: bitte den Link selbst weitergeben.',
    });
    expect(logs).toEqual(['Invitation mail failed']);
  });
});

describe('passkey routes', () => {
  const cfg = { publicUrl: 'https://nova.example.org' };

  it('registers, lists, logs in with and removes a passkey', async () => {
    const { ctx, call } = await player({ cfg });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const options = await call('POST', '/api/passkeys/register/options', {
      password: 'secret1',
    });
    expect(options.json).toMatchObject({
      options: { rp: { id: 'nova.example.org' } },
      ceremony: expect.any(String),
    });
    vi.mocked(webauthn.verifyRegistrationResponse).mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        credential: { id: 'key', publicKey: new Uint8Array([1]), counter: 0 },
      },
    } as unknown as webauthn.VerifiedRegistrationResponse);
    expect(
      (
        await call('POST', '/api/passkeys/register', {
          ceremony: options.json!.ceremony,
          response: {},
        })
      ).json,
    ).toEqual({ ok: true });
    expect((await call('POST', '/api/passkeys/list', {})).json).toEqual({
      keys: [{ id: 'key', created: ctx.now() }],
    });

    const login = await call('POST', '/api/passkeys/login/options', {});
    vi.mocked(webauthn.verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    } as unknown as webauthn.VerifiedAuthenticationResponse);
    const entered = await call('POST', '/api/passkeys/login', {
      ceremony: login.json!.ceremony,
      remember: true,
      response: {
        id: 'key',
        response: { userHandle: Buffer.from('u_Anna').toString('base64url') },
      },
    });
    expect(entered.json).toMatchObject({ ok: true, state: expect.any(Object) });
    expect(entered.set).toMatch(/; Max-Age=\d+$/);
    expect(
      ctx.store.db
        .prepare(
          "SELECT actor, outcome FROM audit_events WHERE action = 'loginPasskey'",
        )
        .all(),
    ).toEqual([{ actor: 'u_Anna', outcome: 'ok' }]);

    expect(
      (await call('POST', '/api/passkeys/remove', { id: 'key' })).json,
    ).toEqual({ ok: true });
    expect((await call('POST', '/api/passkeys/list', {})).json).toEqual({
      keys: [],
    });
  });

  it('logs in without remembering when not asked to', async () => {
    const { ctx, call } = await player({ cfg });
    ctx.store.db
      .prepare("INSERT INTO passkeys VALUES ('key', 'u_Anna', x'01', 0, 0)")
      .run();
    const login = await call('POST', '/api/passkeys/login/options', {});
    vi.mocked(webauthn.verifyAuthenticationResponse).mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    } as unknown as webauthn.VerifiedAuthenticationResponse);
    const entered = await call('POST', '/api/passkeys/login', {
      ceremony: login.json!.ceremony,
      response: {
        id: 'key',
        response: { userHandle: Buffer.from('u_Anna').toString('base64url') },
      },
    });
    expect(entered.set).not.toContain('Max-Age');
  });
});

describe('player actions', () => {
  it('audits a game action on the selected own planet, else on the home planet', async () => {
    const { ctx, call } = await player();
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addUser(ctx, 'Bob');
    addPlanet(ctx, 'u_Bob', { p: 9 });
    addPlanet(ctx, 'u_Anna', { p: 7 });
    const act = (planet: unknown) =>
      call('POST', '/api/action', { type: 'rename', name: 'X', planet });
    await act('p1_1_7');
    await act('p1_1_9');
    await act(7);
    await call('POST', '/api/action', { type: 'nonsense' });
    expect(
      ctx.store.db
        .prepare(
          "SELECT category, action, detail FROM audit_events WHERE actor = 'u_Anna' AND action != 'login' ORDER BY id",
        )
        .all(),
    ).toEqual([
      { category: 'game', action: 'rename', detail: '{"planet":"p1_1_7"}' },
      { category: 'game', action: 'rename', detail: '{"planet":"p1_1_5"}' },
      { category: 'game', action: 'rename', detail: '{"planet":"p1_1_5"}' },
      { category: 'game', action: 'unknown', detail: '{"planet":"p1_1_5"}' },
    ]);
  });

  it('audits universe settings as an admin write with before and after', async () => {
    const { ctx, call } = await asAdmin();
    const before = ctx.store.universe();
    const reply = await call('POST', '/api/action', {
      type: 'settings',
      settings: { ...before, speed: 3 },
    });
    expect(reply.json).toMatchObject({ ok: true });
    expect(ctx.store.universe().speed).toBe(3);
    const row = ctx.store.db
      .prepare(
        "SELECT category, detail FROM audit_events WHERE action = 'settings'",
      )
      .get() as { category: string; detail: string };
    expect(row.category).toBe('admin.write');
    expect(JSON.parse(row.detail)).toEqual({
      before,
      after: ctx.store.universe(),
    });
  });
});

describe('push routes', () => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: {
      p256dh: Buffer.alloc(65, 4).toString('base64url'),
      auth: Buffer.alloc(16, 1).toString('base64url'),
    },
  };

  it('refuses subscriptions while web push is off, but always unsubscribes', async () => {
    const { call } = await player();
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const off = {
      error:
        'Browser-Benachrichtigungen sind auf diesem Server deaktiviert. Die Serverkonfiguration benötigt NOVA_WEB_PUSH=1 und eine HTTPS-Adresse.',
    };
    expect((await call('GET', '/api/push/key')).json).toEqual(off);
    expect(
      (await call('POST', '/api/push/subscribe', subscription)).json,
    ).toEqual(off);
    expect(
      (
        await call('POST', '/api/push/unsubscribe', {
          endpoint: subscription.endpoint,
        })
      ).json,
    ).toEqual({ ok: true });
  });

  it('hands out the key and stores and removes a subscription', async () => {
    const { ctx, call } = await player({ cfg: { webPush: true } });
    expect((await call('GET', '/api/push/key')).status).toBe(401);
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    expect((await call('GET', '/api/push/key')).json).toEqual({
      publicKey: expect.stringMatching(/^[\w-]{87}$/),
    });
    expect(
      (await call('POST', '/api/push/subscribe', subscription)).json,
    ).toEqual({ ok: true });
    const count = () =>
      (
        ctx.store.db
          .prepare('SELECT COUNT(*) AS n FROM push_subscriptions')
          .get() as { n: number }
      ).n;
    expect(count()).toBe(1);
    await call('POST', '/api/push/unsubscribe', {
      endpoint: subscription.endpoint,
    });
    expect(count()).toBe(0);
  });
});

describe('account audit and replies', () => {
  const rows = (ctx: { store: { db: import('better-sqlite3').Database } }) =>
    ctx.store.db
      .prepare(
        "SELECT category, action, actor, outcome FROM audit_events WHERE category = 'account' ORDER BY id",
      )
      .all();

  it('registers with a remembered session, or asks for a code first', async () => {
    for (const emailLoginCodes of [false, true]) {
      const { call, ctx, cfg } = await start({ cfg: { emailLoginCodes } });
      const { link } = createInvitation(ctx, cfg, null, 'neu@example.org');
      const reply = await call('POST', '/api/register', {
        token: link.split('#invite=')[1],
        name: 'Neu',
        password: 'registration-passphrase',
        planet: 'Welt',
        gal: 1,
      });
      if (emailLoginCodes) {
        expect(reply.json).toEqual({ ok: true, loginRequired: true });
        expect(reply.set).toBeNull();
      } else {
        expect(reply.json).toMatchObject({ ok: true });
        expect(reply.set).toMatch(/; Max-Age=\d+$/);
      }
      expect(rows(ctx)).toEqual([
        {
          category: 'account',
          action: 'register',
          actor: expect.stringMatching(/^u/),
          outcome: 'ok',
        },
      ]);
    }
  });

  it('audits password and code logins, a refused code and logout', async () => {
    const mails: Mail[] = [];
    const codes = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    const { challenge } = (
      await codes.call('POST', '/api/login', {
        name: 'Anna',
        password: 'secret1',
      })
    ).json as { challenge: string };
    const code = /\d{6}/.exec(mails[0]!.text)![0];
    expect(
      (await codes.call('POST', '/api/login/code', { challenge, code: 'x' }))
        .json,
    ).toEqual({ error: 'Der Anmeldecode ist ungültig oder abgelaufen.' });
    const entered = await codes.call('POST', '/api/login/code', {
      challenge,
      code,
      remember: false,
    });
    expect(entered.json).toMatchObject({ ok: true });
    expect(entered.set).not.toContain('Max-Age');
    expect(rows(codes.ctx)).toEqual([
      {
        category: 'account',
        action: 'loginPassword',
        actor: 'u_Anna',
        outcome: 'ok',
      },
      {
        category: 'account',
        action: 'loginCode',
        actor: null,
        outcome: 'rejected',
      },
      {
        category: 'account',
        action: 'loginCode',
        actor: 'u_Anna',
        outcome: 'ok',
      },
    ]);

    const plain = await player();
    await plain.call('POST', '/api/logout', {});
    await plain.call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    await plain.call('POST', '/api/logout', {});
    expect(rows(plain.ctx)).toEqual([
      { category: 'account', action: 'login', actor: 'u_Anna', outcome: 'ok' },
      { category: 'account', action: 'logout', actor: 'u_Anna', outcome: 'ok' },
    ]);
  });

  it('signs out with an empty cookie after a reset, a change and a deletion', async () => {
    const mails: Mail[] = [];
    const { call } = await player({
      mailer: async (m) => void mails.push(m),
    });
    await call('POST', '/api/password/forgot', { email: 'anna@example.org' });
    await tick();
    const token = mails[0]!.text.split('#reset=')[1]!.split('\n')[0];
    const reset = await call('POST', '/api/password/reset', {
      token,
      password: 'a brand new passphrase',
    });
    expect(reset.json).toEqual({ ok: true });
    expect(reset.set).toBe(SIGNED_OUT);
    await call('POST', '/api/login', {
      name: 'Anna',
      password: 'a brand new passphrase',
    });
    const changed = await call('POST', '/api/password/change', {
      current: 'a brand new passphrase',
      password: 'another long passphrase',
      confirmation: 'another long passphrase',
    });
    expect(changed.json).toEqual({ ok: true });
    expect(changed.set).toBe(SIGNED_OUT);
    await call('POST', '/api/login', {
      name: 'Anna',
      password: 'another long passphrase',
    });
    const deleted = await call('POST', '/api/account/delete', {
      password: 'another long passphrase',
    });
    expect(deleted.json).toEqual({ ok: true });
    expect(deleted.set).toBe(SIGNED_OUT);
  });
});

describe('news', () => {
  it('serves „Neuigkeiten“ to logged-in players only, empty without a changelog', async () => {
    const news = {
      version: '26.11.1',
      versions: [
        {
          version: '26.11.1',
          date: '12.11.2026',
          entries: [{ kind: 'neu' as const, text: 'Neuigkeiten.' }],
        },
      ],
    };
    const { call } = await player({ news });
    expect((await call('GET', '/api/news')).status).toBe(401);
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    expect((await call('GET', '/api/news')).json).toEqual(news);
    const plain = await player();
    await plain.call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    expect((await plain.call('GET', '/api/news')).json).toEqual({
      version: null,
      versions: [],
    });
  });
});

describe('game requests', () => {
  it('answers activity, reads the selected planet and names the error cases', async () => {
    const logs: string[] = [];
    const { ctx, call, app } = await player({ logs });
    expect((await call('GET', '/api/state')).json).toEqual({
      error: 'Bitte einloggen.',
    });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addPlanet(ctx, 'u_Anna', { p: 7 });
    expect((await call('POST', '/api/activity', {})).json).toEqual({
      ok: true,
    });
    const state = await call('GET', '/api/state?planet=p1_1_7');
    expect(state.json).toMatchObject({ planet: { id: 'p1_1_7' } });
    expect(
      (
        await call(
          'POST',
          '/api/action',
          { type: 'rename', name: 'X' },
          {
            origin: 'https://evil.example',
          },
        )
      ).json,
    ).toEqual({ error: 'Anfrage abgelehnt.' });
    expect((await call('DELETE', '/x')).json).toEqual({
      error: 'Nicht erlaubt.',
    });
    ctx.store.db.close();
    const broken = await call('POST', '/api/activity', {});
    expect(broken.json).toEqual({ error: 'Serverfehler.' });
    expect(logs).toEqual([
      expect.stringMatching(/^Request failed \[[0-9a-f-]{36}\]$/),
      'Error log write failed',
    ]);
    expect(() => app.sweep()).toThrow();
  });

  it('audits a round reset as an admin write without a planet', async () => {
    const { ctx, call } = await asAdmin();
    await call('POST', '/api/action', { type: 'reset' });
    expect(
      ctx.store.db
        .prepare(
          "SELECT category, detail FROM audit_events WHERE action = 'reset'",
        )
        .get(),
    ).toMatchObject({ category: 'admin.write' });
    const plain = await player();
    await plain.call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    await plain.call('POST', '/api/action', { type: 'settings', settings: {} });
    expect(
      plain.ctx.store.db
        .prepare(
          "SELECT category, outcome, detail FROM audit_events WHERE action = 'settings'",
        )
        .get(),
    ).toEqual({ category: 'admin.write', outcome: 'rejected', detail: '{}' });
  });
});

describe('rate limit window and sweep', () => {
  it('opens again after the configured minutes and forgets old windows', async () => {
    const { ctx, call, app } = await start({
      cfg: { rateLimitAttempts: 1, rateLimitMinutes: 2 },
    });
    const check = () => call('POST', '/api/invite/check', { token: 'x' });
    await check();
    expect((await check()).json).toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    ctx.clock.t += 2 * 60000 - 1;
    expect((await check()).json).toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    ctx.clock.t += 1;
    expect((await check()).json).not.toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    ctx.store.db
      .prepare("INSERT INTO passkey_challenges VALUES ('c', 'x', NULL, ?)")
      .run(ctx.now());
    addUser(ctx, 'Anna');
    ctx.store.db
      .prepare(
        "INSERT INTO account_tokens (token_hash, user_id, purpose, expires) VALUES ('t', 'u_Anna', 'reset', ?)",
      )
      .run(ctx.now());
    const count = (table: string) =>
      ctx.store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
    expect(count('account_tokens')).toEqual({ n: 1 });
    app.sweep();
    expect(count('passkey_challenges')).toEqual({ n: 0 });
    expect(count('account_tokens')).toEqual({ n: 0 });
  });
});
