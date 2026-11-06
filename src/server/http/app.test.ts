import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Config } from '../config.ts';
import type { Mail, Mailer } from '../mail.ts';
import {
  addPlanet,
  addUser,
  testConfig,
  testCtx,
  type TestCtx,
} from '../test-helpers.ts';
import { COOKIE, createApp, crossSite, sessionCookie } from './app.ts';
import { CSP } from './security.ts';

const PUBLIC = path.resolve(import.meta.dirname, '../../test/public');
let server: Server | null = null;

const close = async (): Promise<void> => {
  server?.closeAllConnections();
  await new Promise((r) => (server ? server.close(r) : r(null)));
};

afterEach(async () => {
  await close();
  server = null;
});

async function start(
  over: { cfg?: Partial<Config>; mailer?: Mailer | null; logs?: string[] } = {},
) {
  const ctx: TestCtx = testCtx();
  const cfg = testConfig(over.cfg);
  const app = createApp({
    ctx,
    cfg,
    mailer: over.mailer ?? null,
    publicDir: PUBLIC,
    log: (m) => over.logs?.push(m),
  });
  server = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  let cookie = '';
  const call = async (
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0]!;
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // not JSON
    }
    return { status: res.status, headers: res.headers, json, text, set };
  };
  return { ctx, cfg, call, app, setCookie: (c: string) => (cookie = c) };
}

async function asAdmin(over: Parameters<typeof start>[0] = {}) {
  const s = await start(over);
  addUser(s.ctx, 'Boss', { admin: true });
  addPlanet(s.ctx, 'u_Boss');
  expect(
    (await s.call('POST', '/api/login', { name: 'boss', password: 'secret1' }))
      .status,
  ).toBe(200);
  return s;
}

describe('http', () => {
  it('serves the client with security headers and blocks path traversal', async () => {
    const { call } = await start();
    const page = await call('GET', '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(page.headers.get('content-security-policy')).toBe(CSP);
    expect(page.headers.get('x-frame-options')).toBe('DENY');
    expect(
      (await call('GET', '/app.css?v=1')).headers.get('content-type'),
    ).toBe('text/css; charset=utf-8');
    expect((await call('GET', '/missing.js')).status).toBe(404);
    // ".." cannot leave the folder: the path is normalized inside it.
    expect((await call('GET', '/%2e%2e/%2e%2e/package.json')).status).toBe(404);
    expect((await call('GET', '/%E0%A4%A')).status).toBe(403);
    expect((await call('POST', '/index.html', {})).status).toBe(405);
    expect((await call('GET', '/healthz')).json).toEqual({ ok: true });
    expect((await call('GET', '/api/nope')).status).toBe(404);
  });

  it('needs a session for the game', async () => {
    const { call } = await start();
    expect(await call('GET', '/api/state')).toMatchObject({
      status: 401,
      json: { error: 'Bitte einloggen.' },
    });
    expect((await call('POST', '/api/action', { type: 'read' })).status).toBe(
      401,
    );
  });

  it('refuses cross-site posts, non-JSON and broken bodies', async () => {
    const { call } = await start();
    expect(
      (
        await call(
          'POST',
          '/api/login',
          { name: 'x' },
          { origin: 'https://evil.example' },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call('POST', '/api/login', 'name=x', {
          'content-type': 'application/x-www-form-urlencoded',
        })
      ).status,
    ).toBe(403);
    expect((await call('POST', '/api/login', '{broken')).json).toEqual({
      error: 'Ungültige Anfrage.',
    });
    expect((await call('POST', '/api/login', '[1]')).json).toEqual({
      error: 'Ungültige Anfrage.',
    });
    expect((await call('POST', '/api/login', 'x'.repeat(70000))).json).toEqual({
      error: 'Anfrage zu groß.',
    });
    expect(
      (
        await call(
          'POST',
          '/api/login',
          { name: 'a' },
          { origin: 'http://localhost:8080' },
        )
      ).json,
    ).toEqual({ error: 'Name oder Passwort falsch.' });
  });

  it('logs in, plays and logs out', async () => {
    const { ctx, call } = await start();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { res: { m: 1000, c: 1000, d: 0 } });
    const login = await call('POST', '/api/login', {
      name: 'Anna',
      password: 'secret1',
    });
    expect(login.status).toBe(200);
    expect(login.set).toMatch(
      new RegExp(
        `^${COOKIE}=[\\w-]{43}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000$`,
      ),
    );
    expect((login.json!.state as { me: { name: string } }).me.name).toBe(
      'Anna',
    );
    expect((await call('GET', '/api/state')).status).toBe(200);
    const act = await call('POST', '/api/action', {
      type: 'options',
      probes: 3,
    });
    expect(act.json).toMatchObject({
      ok: true,
      msg: 'Gespeichert.',
      state: { me: { probes: 3 } },
    });
    expect((await call('POST', '/api/action', { type: 'nope' })).json).toEqual({
      error: 'Unbekannte Aktion.',
    });
    const out = await call('POST', '/api/logout', {});
    expect(out.set).toContain('Max-Age=0');
    expect((await call('GET', '/api/state')).status).toBe(401);
  });

  it('marks cookies secure behind https', () => {
    expect(sessionCookie(testConfig({ secureCookies: true }), 'abc')).toBe(
      `${COOKIE}=abc; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Secure`,
    );
  });

  it('limits login attempts per address', async () => {
    const { call } = await start({ cfg: { rateLimitAttempts: 2 } });
    for (let i = 0; i < 2; i++)
      expect((await call('POST', '/api/login', {})).json).toEqual({
        error: 'Name oder Passwort falsch.',
      });
    expect((await call('POST', '/api/login', {})).json).toEqual({
      error: 'Zu viele Versuche – bitte später nochmal.',
    });
    expect((await call('POST', '/api/invite/check', {})).json!.error).toContain(
      'Zu viele',
    );
  });

  it('trusts X-Real-IP only behind the proxy', async () => {
    const { call } = await start({
      cfg: { rateLimitAttempts: 1, trustProxy: true },
    });
    await call('POST', '/api/login', {}, { 'x-real-ip': '10.0.0.1' });
    expect(
      (await call('POST', '/api/login', {}, { 'x-real-ip': '10.0.0.2' })).json!
        .error,
    ).toBe('Name oder Passwort falsch.');
    expect(
      (await call('POST', '/api/login', {}, { 'x-real-ip': '10.0.0.1' })).json!
        .error,
    ).toContain('Zu viele');
  });

  it('invites by mail, registers with the link and keeps nobody admin', async () => {
    const mails: Mail[] = [];
    const { ctx, call, setCookie } = await asAdmin({
      mailer: async (m) => void mails.push(m),
    });
    const inv = await call('POST', '/api/admin/invite', {
      email: 'new@example.org',
    });
    expect(inv.json).toMatchObject({
      ok: true,
      mailed: true,
      msg: 'Einladung an new@example.org gesendet.',
    });
    const link = inv.json!.link as string;
    expect(mails[0]).toMatchObject({
      to: 'new@example.org',
      subject: 'Einladung zu Nova Imperium',
    });
    expect(mails[0]!.text).toContain(link);
    expect(
      (inv.json!.state as { admin: { invitations: unknown[] } }).admin
        .invitations,
    ).toHaveLength(1);
    const token = link.split('#invite=')[1]!;
    setCookie('');
    expect((await call('POST', '/api/invite/check', { token })).json).toEqual({
      email: 'new@example.org',
      galaxies: 2,
    });
    expect(
      (await call('POST', '/api/invite/check', { token: 'x' })).status,
    ).toBe(400);
    const reg = await call('POST', '/api/register', {
      token,
      name: 'Neu',
      password: 'secret9',
      planet: 'P',
      gal: 1,
    });
    expect(reg.status).toBe(200);
    expect((reg.json!.state as { me: { admin: boolean } }).me.admin).toBe(
      false,
    );
    expect(ctx.store.userByName('Neu')?.email).toBe('new@example.org');
    expect(
      (
        await call('POST', '/api/register', {
          token,
          name: 'Zwei',
          password: 'secret9',
        })
      ).status,
    ).toBe(400);
    expect(
      (await call('POST', '/api/admin/invite', { email: 'x@example.org' }))
        .json,
    ).toEqual({ error: 'Nur der Admin darf das.' });
  });

  it('gives the link to copy when the mail fails or SMTP is off', async () => {
    const logs: string[] = [];
    const failing = await asAdmin({
      mailer: async () => Promise.reject(new Error('down')),
      logs,
    });
    const r = await failing.call('POST', '/api/admin/invite', {
      email: 'a@example.org',
    });
    expect(r.json).toMatchObject({
      mailed: false,
      msg: 'Die Mail konnte nicht gesendet werden: bitte den Link selbst weitergeben.',
    });
    expect(r.json!.link).toMatch(/^http:\/\/localhost:8080\/#invite=/);
    expect(logs).toEqual(['Invitation mail failed']);
    await close();
    const off = await asAdmin();
    expect(
      (await off.call('POST', '/api/admin/invite', { email: 'b@example.org' }))
        .json,
    ).toMatchObject({
      mailed: false,
      msg: 'Kein SMTP eingerichtet: bitte den Link selbst weitergeben.',
    });
  });

  it('revokes invitations as admin only', async () => {
    const { ctx, call } = await asAdmin();
    await call('POST', '/api/admin/invite', { email: 'a@example.org' });
    const id = ctx.store.openInvitations(ctx.now())[0]!.id;
    const r = await call('POST', '/api/admin/revoke', { id });
    expect(r.json).toMatchObject({ ok: true, msg: 'Einladung widerrufen.' });
    expect(ctx.store.openInvitations(ctx.now())).toEqual([]);
    ctx.store.saveUser({ ...ctx.store.userByName('Boss')!, admin: false });
    expect((await call('POST', '/api/admin/revoke', {})).json).toEqual({
      error: 'Nur der Admin darf das.',
    });
  });

  it('answers 500 without details on an unexpected error', async () => {
    const logs: string[] = [];
    const { ctx, call } = await start({ logs });
    ctx.store.db.close();
    const r = await call('GET', '/healthz');
    expect(r).toMatchObject({ status: 500, json: { error: 'Serverfehler.' } });
    expect(logs).toEqual(['Request failed']);
  });

  it('sweeps the rate limiter', async () => {
    const { app } = await start();
    expect(() => app.sweep()).not.toThrow();
  });

  it('detects cross-site requests', () => {
    const cfg = testConfig();
    const req = (method: string, headers: Record<string, string>) =>
      ({ method, headers }) as never;
    expect(crossSite(req('GET', {}), cfg)).toBe(false);
    expect(
      crossSite(
        req('POST', { 'content-type': 'application/json; charset=utf-8' }),
        cfg,
      ),
    ).toBe(false);
    expect(
      crossSite(req('POST', { 'content-type': 'Application/JSON' }), cfg),
    ).toBe(false);
    expect(crossSite(req('POST', {}), cfg)).toBe(true);
    expect(crossSite(req('POST', { 'content-type': 'text/plain' }), cfg)).toBe(
      true,
    );
    expect(
      crossSite(
        req('POST', {
          'content-type': 'application/json',
          origin: 'http://localhost:8080',
        }),
        cfg,
      ),
    ).toBe(false);
    expect(
      crossSite(
        req('POST', { 'content-type': 'application/json', origin: 'null' }),
        cfg,
      ),
    ).toBe(true);
  });
});
