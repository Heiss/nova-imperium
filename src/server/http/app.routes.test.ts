// Routes of app.ts that the flow tests in app.test.ts leave open: answers
// and headers, the rate limit of every guarded route, mails for login codes
// and resets, passkey routes (WebAuthn check replaced) and invitations.
import * as webauthn from '@simplewebauthn/server';
import { describe, expect, it, vi } from 'vitest';
import { createInvitation } from '../auth.ts';
import type { Mail } from '../mail.ts';
import { addPlanet, addUser } from '../test-helpers.ts';
import { asAdmin, start } from '../../test/http.ts';
import { adminRoutes } from './admin.ts';
import { COOKIE, type AppDeps } from './app.ts';

// The password check is the cost of every login here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) =>
  (await import('../../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
);

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

  it('guards the actions that take the password, not the others (#224)', async () => {
    const { ctx, call } = await player({ cfg: { rateLimitAttempts: 1 } });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addPlanet(ctx, 'u_Anna', { p: 7, created: 1 });
    const abandon = () =>
      call('POST', '/api/action', {
        type: 'abandon',
        target: 'p1_1_7',
        password: 'secret1',
      });
    expect((await abandon()).json).toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    expect(ctx.planets.get('p1_1_7')).not.toBeNull();
    const rename = await call('POST', '/api/action', {
      type: 'rename',
      name: 'X',
    });
    expect(rename.json).toMatchObject({ ok: true });
  });

  it('guards a password action whose type is not a string (#224)', async () => {
    const { ctx, call } = await player({ cfg: { rateLimitAttempts: 1 } });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addPlanet(ctx, 'u_Anna', { p: 7, created: 1 });
    const out = await call('POST', '/api/action', {
      type: ['abandon'],
      target: 'p1_1_7',
      password: 'secret1',
    });
    expect(out.json).toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    expect(ctx.planets.get('p1_1_7')).not.toBeNull();
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
    // A mail that fails: the code form comes all the same, the failure is in
    // the admin's error log only (101b, #401).
    const logs: string[] = [];
    const failing = await player({
      ...codes,
      mailer: () => Promise.reject(new Error('smtp down')),
      logs,
    });
    expect((await failing.call('POST', '/api/login', login)).json).toEqual({
      code: true,
    });
    await tick();
    await tick();
    expect(logs).toEqual(['Login code mail failed']);
    expect(
      failing.ctx.db
        .prepare('SELECT kind, action, player, message FROM error_events')
        .all(),
    ).toEqual([
      {
        kind: 'server',
        action: 'mail',
        player: 'u_Anna',
        message: 'Error: smtp down',
      },
    ]);
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
    // The challenge stays in the browser's cookie, never in the page (129a,
    // #401): HttpOnly, for the sign-in routes only, as long as the code.
    expect(sent.json).toEqual({ code: true });
    expect(sent.set).toMatch(
      /^nova_login=[\w-]{43}\.1; HttpOnly; Path=\/api\/login; SameSite=Lax; Max-Age=600$/,
    );
    expect(mails).toEqual([
      {
        to: 'anna@example.org',
        subject: 'Dein Anmeldecode für Nova Imperium',
        // Text 1 of the owner, the code in the fragment of the link.
        text: expect.stringMatching(
          /^Dein Anmeldecode lautet (\d{6})\. Er gilt einmal und für zehn Minuten\. Oder melde dich direkt mit diesem Link an: http:\/\/localhost:8080\/#code=\1\. Der Link funktioniert nur in dem Browser, in dem du die Anmeldung begonnen hast\. Wenn du das nicht warst, ignoriere diese E-Mail\.$/,
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
      ctx.db
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
    ctx.db
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
      ctx.db
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

  it('audits a game action without a selection on the chosen main planet (#221)', async () => {
    const { ctx, call } = await player();
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addPlanet(ctx, 'u_Anna', { p: 7 });
    const main = await call('POST', '/api/action', {
      type: 'mainPlanet',
      main: 'p1_1_7',
    });
    expect(main.json).toMatchObject({
      msg: 'Planet u_Anna ist jetzt dein Hauptplanet.',
      state: { homePlanet: 'p1_1_5', mainPlanet: 'p1_1_7' },
    });
    await call('POST', '/api/action', { type: 'rename', name: 'X' });
    expect(
      ctx.db
        .prepare(
          "SELECT action, detail FROM audit_events WHERE actor = 'u_Anna' AND category = 'game' ORDER BY id",
        )
        .all(),
    ).toEqual([
      { action: 'mainPlanet', detail: '{"planet":"p1_1_5"}' },
      { action: 'rename', detail: '{"planet":"p1_1_7"}' },
    ]);
    expect(ctx.planets.get('p1_1_7')!.name).toBe('X');
  });

  it('audits a given-up colony without the password (#224)', async () => {
    const { ctx, call } = await player();
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    addPlanet(ctx, 'u_Anna', { p: 7, created: ctx.now() + 1 });
    const wrong = await call('POST', '/api/action', {
      type: 'abandon',
      target: 'p1_1_7',
      password: 'falsch',
      planet: 'p1_1_7',
    });
    expect(wrong.json).toEqual({ error: 'Das bisherige Passwort ist falsch.' });
    const done = await call('POST', '/api/action', {
      type: 'abandon',
      target: 'p1_1_7',
      created: ctx.planets.get('p1_1_7')!.created,
      password: 'secret1',
      planet: 'p1_1_7',
    });
    // The state falls back to the main planet once the shown one is gone.
    expect(done.json).toMatchObject({
      msg: 'Die Kolonie Planet u_Anna [1:1:7] wurde aufgegeben.',
      state: { planet: { id: 'p1_1_5' }, mainPlanet: 'p1_1_5' },
    });
    const rows = ctx.db
      .prepare(
        "SELECT outcome, detail FROM audit_events WHERE actor = 'u_Anna' AND action = 'abandon' ORDER BY id",
      )
      .all() as { outcome: string; detail: string }[];
    expect(rows.map((r) => r.outcome)).toEqual(['rejected', 'ok']);
    expect(JSON.parse(rows[1]!.detail)).toEqual({
      planet: 'p1_1_7',
      moon: null,
      until: ctx.now() + 24 * 3_600_000,
    });
    for (const row of rows) expect(row.detail).not.toMatch(/secret1|falsch/);
  });

  it('marks activity: a login the main planet, an action or an interaction every own planet (#229)', async () => {
    const { ctx, call } = await player();
    addPlanet(ctx, 'u_Anna', { p: 7 });
    addPlanet(ctx, 'u_Anna', { p: 7, kind: 'moon', id: 'm1_1_7' });
    const t0 = ctx.now();
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    expect(ctx.planets.activeTimes()).toEqual({ p1_1_5: t0 });
    expect(ctx.players.lastActive().u_Anna).toBe(t0);
    ctx.clock.t += 1000;
    // A refused action is a manual action too.
    const refused = await call('POST', '/api/action', { type: 'unknown' });
    expect(refused.json).toMatchObject({ error: expect.any(String) });
    const t1 = ctx.now();
    expect(ctx.planets.activeTimes()).toEqual({
      p1_1_5: t1,
      p1_1_7: t1,
      m1_1_7: t1,
    });
    ctx.clock.t += 60_000;
    expect((await call('POST', '/api/activity', {})).json).toEqual({
      ok: true,
    });
    const t2 = ctx.now();
    expect(ctx.planets.activeTimes()).toEqual({
      p1_1_5: t2,
      p1_1_7: t2,
      m1_1_7: t2,
    });
    expect(ctx.players.lastActive().u_Anna).toBe(t2);
    // Reading the state is no activity.
    ctx.clock.t += 60_000;
    await call('GET', '/api/state');
    expect(ctx.players.lastActive().u_Anna).toBe(t2);
  });

  it('audits universe settings as an admin write with before and after', async () => {
    const { ctx, call } = await asAdmin();
    const before = ctx.admin.universe();
    const reply = await call('POST', '/api/action', {
      type: 'settings',
      settings: { ...before, speed: 3 },
    });
    expect(reply.json).toMatchObject({ ok: true });
    expect(ctx.admin.universe().speed).toBe(3);
    const row = ctx.db
      .prepare(
        "SELECT category, detail FROM audit_events WHERE action = 'settings'",
      )
      .get() as { category: string; detail: string };
    expect(row.category).toBe('admin.write');
    expect(JSON.parse(row.detail)).toEqual({
      before,
      after: ctx.admin.universe(),
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
    // The options hide the push kinds (#192).
    expect((await call('GET', '/api/account/policy')).json).toMatchObject({
      webPush: false,
    });
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
    // The options show the push kinds (#192).
    expect((await call('GET', '/api/account/policy')).json).toMatchObject({
      webPush: true,
    });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    expect((await call('GET', '/api/push/key')).json).toEqual({
      publicKey: expect.stringMatching(/^[\w-]{87}$/),
    });
    expect(
      (await call('POST', '/api/push/subscribe', subscription)).json,
    ).toEqual({ ok: true });
    const count = () =>
      (
        ctx.db
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
  const rows = (ctx: { db: import('better-sqlite3').Database }) =>
    ctx.db
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

  it('answers before the mail is sent (101b, #401)', async () => {
    let sent: (() => void) | undefined;
    const mails: Mail[] = [];
    const { call } = await player({
      cfg: { emailLoginCodes: true },
      mailer: (m) =>
        new Promise<void>((done) => {
          sent = () => {
            mails.push(m);
            done();
          };
        }),
    });
    const begun = await call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    // The answer is here while the mail still waits for the SMTP server.
    expect(begun.json).toEqual({ code: true });
    expect(mails).toEqual([]);
    sent!();
    expect(mails).toHaveLength(1);
  });

  it('sends a new code after 30 s on the same challenge (101b, #401)', async () => {
    const mails: Mail[] = [];
    const { ctx, call } = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    const codeOf = (i: number) => /\b\d{6}\b/.exec(mails[i]!.text)![0];
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    await tick();
    // The challenge comes from the cookie of the browser (129a).
    const resend = () => call('POST', '/api/login/resend', {});
    // Before 30 s nothing is sent: the button comes only then.
    ctx.clock.t += 29_999;
    const early = await resend();
    expect(early.json).toEqual({ ok: true });
    expect(early.set).toBeNull();
    await tick();
    expect(mails).toHaveLength(1);
    ctx.clock.t += 1;
    const again = await resend();
    expect(again.json).toEqual({ ok: true });
    // The cookie gets its ten minutes again, as the code does.
    expect(again.set).toMatch(/^nova_login=[\w-]{43}\.1; .*Max-Age=600$/);
    await tick();
    expect(mails).toHaveLength(2);
    expect(mails[1]).toEqual({ ...mails[0], text: expect.any(String) });
    // The old code is void, the failed attempts stay.
    const verify = (code: string) => call('POST', '/api/login/code', { code });
    // (A new code equal to the old one, one in a million, would sign in.)
    if (codeOf(0) !== codeOf(1))
      expect((await verify(codeOf(0))).status).toBe(400);
    // The ten minutes start again with the new code.
    ctx.clock.t += 10 * 60_000 - 1;
    expect((await verify(codeOf(1))).set).toContain('nova_session=');
    // A used challenge sends nothing.
    expect((await resend()).json).toEqual({
      error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
    });
  });

  it('counts the failed attempts across a new code (101b, #401)', async () => {
    const mails: Mail[] = [];
    const { ctx, call, setCookie } = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    for (let i = 0; i < 5; i++)
      await call('POST', '/api/login/code', { code: 'x' });
    ctx.clock.t += 30_000;
    expect((await call('POST', '/api/login/resend', {})).json).toEqual({
      error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
    });
    await tick();
    expect(mails).toHaveLength(1);
    // An unknown sign-in, or none, sends nothing either.
    for (const cookie of [`nova_login=${'u'.repeat(43)}.1`, '']) {
      setCookie(cookie);
      expect((await call('POST', '/api/login/resend', {})).json).toEqual({
        error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
      });
    }
    await tick();
    expect(mails).toHaveLength(1);
  });

  it('refuses a new code while the codes are off', async () => {
    const { call } = await player({
      mailer: async () => undefined,
    });
    expect((await call('POST', '/api/login/resend', {})).json).toEqual({
      error: 'Anmeldecodes sind nicht aktiviert.',
    });
  });

  it('signs in by the link only in the browser of the sign-in (95a, 129a, 130b, #401)', async () => {
    const mails: Mail[] = [];
    const { ctx, call, setCookie } = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    const begin = () =>
      call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const linkOf = (i: number) => /#code=(\d{6})\./.exec(mails[i]!.text)![1]!;
    const link = (code: string) =>
      call('POST', '/api/login/code', { code, link: true });
    const signIn = /nova_login=[^;]+/.exec((await begin()).set!)![0];
    // Another browser: no sign-in there, nothing signed in (text 2).
    setCookie('');
    const other = await link(linkOf(0));
    expect(other.json).toEqual({
      error:
        'Dieser Link gilt nur im Browser, in dem du die Anmeldung begonnen hast. Gib dort den Code aus der E-Mail ein.',
    });
    expect(other.set).toBeNull();
    // A newer sign-in in the same browser: the old link is refused (130b).
    setCookie(signIn);
    await begin();
    if (linkOf(0) !== linkOf(1))
      expect((await link(linkOf(0))).json).toEqual({
        error:
          'Dieser Link gehört zu einer älteren Anmeldung. Gib den Code aus der neuesten E-Mail ein.',
      });
    // The newest link signs in, once.
    const entered = await link(linkOf(1));
    expect(entered.json).toMatchObject({ ok: true });
    expect(entered.set).toContain('nova_session=');
    expect((await call('GET', '/api/state')).status).toBe(200);
    // Used, the sign-in is gone and its cookie cleared; the cookie of the
    // first, replaced sign-in signs in nothing either.
    expect(entered.set).toContain('nova_login=; ');
    setCookie(signIn);
    expect((await link(linkOf(1))).json).toEqual({
      error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
    });
    // An expired sign-in is not called older.
    await begin();
    ctx.clock.t += 10 * 60_000;
    expect((await link(linkOf(2))).json).toEqual({
      error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
    });
  });

  it('keeps the sign-in over a reload and ends it with „Zurück zum Login“ (129a, #401)', async () => {
    const mails: Mail[] = [];
    const { call } = await player({
      cfg: { emailLoginCodes: true, secureCookies: true },
      mailer: async (m) => void mails.push(m),
    });
    const pending = async () => (await call('GET', '/api/login/pending')).json;
    expect(await pending()).toEqual({ pending: false, app: false });
    const begun = await call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    expect(begun.set).toMatch(/; Max-Age=600; Secure$/);
    expect(await pending()).toEqual({ pending: true, app: false });
    const cancelled = await call('POST', '/api/login/cancel', {});
    expect(cancelled.json).toEqual({ ok: true });
    expect(cancelled.set).toBe(
      'nova_login=; HttpOnly; Path=/api/login; SameSite=Lax; Max-Age=0; Secure',
    );
    expect(await pending()).toEqual({ pending: false, app: false });
  });

  it('ends a cancelled sign-in on the server too (#401)', async () => {
    const mails: Mail[] = [];
    const { call, setCookie } = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    const signIn = /nova_login=[^;]+/.exec(
      (await call('POST', '/api/login', { name: 'Anna', password: 'secret1' }))
        .set!,
    )![0];
    await call('POST', '/api/login/cancel', {});
    // The cookie kept elsewhere signs in nothing.
    setCookie(signIn);
    const code = /\b\d{6}\b/.exec(mails[0]!.text)![0];
    expect((await call('POST', '/api/login/code', { code })).json).toEqual({
      error: 'Der Anmeldecode ist ungültig oder abgelaufen.',
    });
  });

  it('audits password and code logins, a refused code and logout', async () => {
    const mails: Mail[] = [];
    const codes = await player({
      cfg: { emailLoginCodes: true },
      mailer: async (m) => void mails.push(m),
    });
    // „Angemeldet bleiben“ is chosen in the login form and kept in the
    // cookie of the sign-in, for the typed code and the link alike.
    await codes.call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
      remember: false,
    });
    const code = /\d{6}/.exec(mails[0]!.text)![0];
    expect(
      (await codes.call('POST', '/api/login/code', { code: 'x' })).json,
    ).toEqual({ error: 'Der Anmeldecode ist ungültig oder abgelaufen.' });
    const entered = await codes.call('POST', '/api/login/code', {
      code,
      link: true,
      // The wish of the login form counts, not one sent with the code.
      remember: true,
    });
    expect(entered.json).toMatchObject({ ok: true });
    // A session for this visit only; the sign-in cookie is cleared.
    expect(entered.headers.getSetCookie()).toEqual([
      expect.stringMatching(
        /^nova_session=[\w-]+; HttpOnly; Path=\/; SameSite=Lax$/,
      ),
      'nova_login=; HttpOnly; Path=/api/login; SameSite=Lax; Max-Age=0',
    ]);
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

describe('the vacation mode (#223, owner, 2026-11-18)', () => {
  async function away() {
    const s = await player();
    await s.call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const u = s.ctx.players.get('u_Anna')!;
    s.ctx.players.save({ ...u, vacation: s.ctx.now() });
    return s;
  }

  it('answers the state with the lock screen, none of the game', async () => {
    const { call } = await away();
    const state = (await call('GET', '/api/state')).json as Record<
      string,
      unknown
    >;
    expect(state).toMatchObject({
      planet: null,
      reports: [],
      fleets: [],
      galaxy: [],
      players: {},
      me: { id: 'u_Anna', vacation: expect.any(Number) },
    });
  });

  it('refuses every action but the end and the push settings, also one that is unknown', async () => {
    const { call } = await away();
    for (const type of ['build', 'read', 'options', 'sendGuildChat', 'abandon'])
      expect((await call('POST', '/api/action', { type })).json).toEqual({
        error: 'Im Urlaubsmodus nicht möglich.',
      });
    expect(
      (await call('POST', '/api/action', { type: 'pushOptions', off: [] }))
        .json,
    ).toMatchObject({ ok: true, msg: 'Gespeichert.' });
  });

  it('keeps the routes of the account: password, passkeys, push, news, sign-out and the deletion', async () => {
    const { call } = await away();
    expect((await call('POST', '/api/passkeys/list', {})).status).toBe(200);
    expect((await call('GET', '/api/news')).status).toBe(200);
    expect(
      (
        await call('POST', '/api/push/unsubscribe', {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        })
      ).json,
    ).toEqual({ ok: true });
    const changed = await call('POST', '/api/password/change', {
      current: 'secret1',
      password: 'another long passphrase',
      confirmation: 'another long passphrase',
    });
    expect(changed.json).toEqual({ ok: true });
    expect(changed.set).toBe(SIGNED_OUT);
    await call('POST', '/api/login', {
      name: 'Anna',
      password: 'another long passphrase',
    });
    expect((await call('POST', '/api/logout', {})).set).toBe(SIGNED_OUT);
    await call('POST', '/api/login', {
      name: 'Anna',
      password: 'another long passphrase',
    });
    const deleted = await call('POST', '/api/account/delete', {
      password: 'another long passphrase',
    });
    expect(deleted.set).toBe(SIGNED_OUT);
  });

  it('records no activity: login, state, a refused action, the push settings and the interaction leave the times as they were (#223, owner, 2026-11-18)', async () => {
    const { ctx, call } = await away();
    const before = {
      planets: ctx.planets.activeTimes(),
      players: ctx.players.lastActive(),
    };
    expect(Object.keys(before.planets)).not.toEqual([]);
    ctx.clock.t += 3_600_000;
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    await call('GET', '/api/state');
    await call('POST', '/api/action', { type: 'build' });
    await call('POST', '/api/action', { type: 'pushOptions', off: [] });
    await call('POST', '/api/activity', {});
    expect({
      planets: ctx.planets.activeTimes(),
      players: ctx.players.lastActive(),
    }).toEqual(before);
  });

  it('records activity again from the action that ends the vacation (#223)', async () => {
    const { ctx, call } = await away();
    ctx.clock.t += 48 * 3_600_000;
    const before = ctx.planets.activeTimes();
    await call('POST', '/api/action', { type: 'endVacation' });
    expect(ctx.planets.activeTimes()).not.toEqual(before);
    expect(ctx.planets.activeTimes().p1_1_5).toBe(ctx.now());
    expect(ctx.players.lastActive().u_Anna).toBe(ctx.now());
    ctx.clock.t += 1000;
    await call('POST', '/api/activity', {});
    expect(ctx.players.lastActive().u_Anna).toBe(ctx.now());
  });

  it('ends with „endVacation“ after the minimum duration and shows the game again', async () => {
    const { ctx, call } = await away();
    expect(
      (await call('POST', '/api/action', { type: 'endVacation' })).json,
    ).toMatchObject({ error: expect.stringContaining('frühestens beendbar') });
    ctx.clock.t += 48 * 3_600_000;
    const done = await call('POST', '/api/action', { type: 'endVacation' });
    expect(done.json).toMatchObject({
      msg: 'Urlaubsmodus beendet.',
      state: { planet: { id: 'p1_1_5' }, me: { vacation: null } },
    });
  });
});

describe('the admin routes of an admin in vacation mode (#223, owner, 2026-11-18)', () => {
  // The routes the app builds, so a route added later is covered too.
  const routes = (s: { ctx: AppDeps['ctx'] }) =>
    Object.keys(
      adminRoutes(
        { ctx: s.ctx } as AppDeps,
        () => s.ctx.players.get('u_Boss')!,
        () => ({
          json: {},
        }),
      ),
    );

  it('refuses every one, reading ones too, and works again after the end', async () => {
    const s = await asAdmin();
    const paths = routes(s).map((r) => r.replace('POST ', ''));
    expect(paths).toContain('/api/admin/stats');
    expect(paths.length).toBeGreaterThan(8);
    const boss = s.ctx.players.get('u_Boss')!;
    s.ctx.players.save({ ...boss, vacation: s.ctx.now() });
    for (const path of paths) {
      const r = await s.call('POST', path, {});
      expect(r.status, path).toBe(400);
      expect(r.json, path).toEqual({ error: 'Im Urlaubsmodus nicht möglich.' });
    }
    s.ctx.clock.t += 48 * 3_600_000;
    await s.call('POST', '/api/action', { type: 'endVacation' });
    expect((await s.call('POST', '/api/admin/stats', {})).status).toBe(200);
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
    ctx.db.close();
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
      ctx.db
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
      plain.ctx.db
        .prepare(
          "SELECT category, outcome, detail FROM audit_events WHERE action = 'settings'",
        )
        .get(),
    ).toEqual({ category: 'admin.write', outcome: 'rejected', detail: '{}' });
  });

  it('audits the „Endzeit“ as an admin write; a second one is rejected (#161)', async () => {
    const { ctx, call } = await asAdmin();
    const reply = await call('POST', '/api/action', {
      type: 'endzeit',
      minutes: 30,
    });
    expect(reply.json).toMatchObject({
      ok: true,
      msg: 'Die Endzeit ist eingeläutet. Gaben unterwegs: 1.',
      // The 30 minutes were for this trigger; the default stays 4 h.
      state: { admin: { endzeit: { minutes: 240, done: true } } },
    });
    const again = await call('POST', '/api/action', {
      type: 'endzeit',
      minutes: 30,
    });
    expect(again.json).toEqual({
      error: 'In dieser Runde wurde die Endzeit schon eingeläutet.',
    });
    const rows = ctx.db
      .prepare(
        "SELECT category, outcome, detail FROM audit_events WHERE action = 'endzeit' ORDER BY id",
      )
      .all() as { category: string; outcome: string; detail: string }[];
    expect(rows.map(({ category, outcome }) => [category, outcome])).toEqual([
      ['admin.write', 'ok'],
      ['admin.write', 'rejected'],
    ]);
    expect(JSON.parse(rows[0]!.detail)).toEqual({
      round: 1,
      minutes: 30,
      recipients: 1,
      due: ctx.now() + 30 * 60000,
    });
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
    ctx.db
      .prepare("INSERT INTO passkey_challenges VALUES ('c', 'x', NULL, ?)")
      .run(ctx.now());
    addUser(ctx, 'Anna');
    ctx.db
      .prepare(
        "INSERT INTO account_tokens (token_hash, user_id, purpose, expires) VALUES ('t', 'u_Anna', 'reset', ?)",
      )
      .run(ctx.now());
    const count = (table: string) =>
      ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
    expect(count('account_tokens')).toEqual({ n: 1 });
    app.sweep();
    expect(count('passkey_challenges')).toEqual({ n: 0 });
    expect(count('account_tokens')).toEqual({ n: 0 });
  });
});
