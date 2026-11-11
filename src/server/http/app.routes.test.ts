// Routes of app.ts that the flow tests in app.test.ts leave open: answers
// and headers, the rate limit of every guarded route, mails for login codes
// and resets, passkey routes (WebAuthn check replaced) and invitations.
import * as webauthn from '@simplewebauthn/server';
import { describe, expect, it, vi } from 'vitest';
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
