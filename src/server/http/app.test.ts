import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { openDatabase } from '../db/database.ts';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { startSession } from '../auth.ts';
import type { Mail } from '../mail.ts';
import {
  addPlanet,
  addUser,
  testConfig,
  testCtx,
  type TestCtx,
} from '../test-helpers.ts';
import { COOKIE, crossSite, sessionCookie } from './app.ts';
import { CSP } from './security.ts';

import { asAdmin, close, start } from '../../test/http.ts';

describe('http', () => {
  it('retries a blocked build without a stale snapshot or a duplicate charge', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'nova-lock-'));
    const file = path.join(dir, 'game.sqlite');
    const db = openDatabase(file);
    const writer = openDatabase(file);
    try {
      const ctx = testCtx(undefined, undefined, db);
      db.pragma('busy_timeout = 0');
      const { cfg, call, setCookie } = await start({ ctx });
      const user = addUser(ctx, 'Anna');
      const planet = addPlanet(ctx, user.id);
      setCookie(`${COOKIE}=${startSession(ctx, cfg, user.id)}`);
      const action = { type: 'build', key: 'metal' };

      // A write committed after a deferred read reproduces the production error.
      expect(() =>
        db.transaction(() => {
          db.prepare('SELECT * FROM planets').get();
          writer
            .prepare('UPDATE planets SET name = ? WHERE id = ?')
            .run('Renamed', planet.id);
          db.prepare('UPDATE planets SET name = ? WHERE id = ?').run(
            'Stale',
            planet.id,
          );
        })(),
      ).toThrow(expect.objectContaining({ code: 'SQLITE_BUSY_SNAPSHOT' }));

      writer.exec('BEGIN IMMEDIATE');
      const busy = await call('POST', '/api/action', action);
      expect(busy.status).toBe(503);
      expect(busy.json?.code).toBe('ACTION_DB_BUSY');
      const activity = await call('POST', '/api/activity', {});
      expect(activity.status).toBe(503);
      expect(activity.json?.code).toBeUndefined();
      expect(ctx.planets.get(planet.id)?.bq).toBeNull();
      writer.exec('COMMIT');

      expect((await call('POST', '/api/action', action)).status).toBe(200);
      expect(ctx.planets.get(planet.id)).toMatchObject({
        name: 'Renamed',
        bq: { key: 'metal', lvl: 1 },
        res: { m: planet.res.m - 60, c: planet.res.c - 15 },
      });
      expect(
        db
          .prepare("SELECT outcome FROM audit_events WHERE action = 'build'")
          .all(),
      ).toEqual([{ outcome: 'ok' }]);
      expect((await call('POST', '/api/activity', {})).status).toBe(200);
    } finally {
      writer.close();
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
      (await call('POST', '/api/admin/invitations', {})).json!.invitations,
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
      password: 'registration-passphrase',
      planet: 'P',
      gal: 1,
    });
    expect(reg.status).toBe(200);
    expect((reg.json!.state as { me: { admin: boolean } }).me.admin).toBe(
      false,
    );
    expect(ctx.players.byName('Neu')?.email).toBe('new@example.org');
    expect(
      (
        await call('POST', '/api/register', {
          token,
          name: 'Zwei',
          password: 'registration-passphrase',
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

  it('restricts and audits admin reads without exposing invitation secrets', async () => {
    const { ctx, call, setCookie } = await asAdmin();
    const boss = (
      await call('POST', '/api/login', { name: 'Boss', password: 'secret1' })
    ).set!;
    const u = addUser(ctx, 'Pilot');
    addPlanet(ctx, u.id, { p: 6 });
    const invite = await call('POST', '/api/admin/invite', {
      email: 'new@example.org',
    });
    const list = await call('POST', '/api/admin/invitations', {});
    expect(list.json!.invitations).toMatchObject([
      { email: 'new@example.org' },
    ]);
    expect(list.text).not.toMatch(/token|#invite/);
    expect((await call('GET', '/api/state')).text).not.toContain(
      'new@example.org',
    );
    const invalid = await call('POST', '/api/admin/player', {
      player: 'missing',
    });
    expect(invalid.status).toBe(400);
    const log = await call('POST', '/api/admin/events', { player: 'u_Boss' });
    expect(log.json!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actor: 'u_Boss',
          action: 'invitations',
          requestId: list.headers.get('x-request-id'),
        }),
        expect.objectContaining({
          actor: 'u_Boss',
          action: 'player',
          target: 'missing',
          outcome: 'rejected',
        }),
      ]),
    );
    expect(log.text).not.toContain(String(invite.json!.link));
    await call('POST', '/api/login', { name: 'Pilot', password: 'secret1' });
    expect((await call('POST', '/api/admin/events', {})).status).toBe(400);
    expect((await call('POST', '/api/admin/stats', {})).status).toBe(400);
    setCookie(boss.split(';')[0]!);
    const filtered = await call('POST', '/api/admin/events', {
      action: 'events',
      outcome: 'ok',
    });
    expect(filtered.json!.events).toMatchObject([
      { action: 'events', category: 'admin.read' },
    ]);
  });

  it('broadcasts a server message as admin and audits the recipient count', async () => {
    const { ctx, call } = await asAdmin();
    const pilot = addUser(ctx, 'Pilot');
    expect(
      (await call('POST', '/api/admin/announce', { message: ' ' })).status,
    ).toBe(400);
    const sent = await call('POST', '/api/admin/announce', {
      message: 'Neue Serverrunde',
    });
    expect(sent.json).toEqual({ recipients: 2 });
    expect(ctx.reports.ofPlayer(pilot.id)).toMatchObject([
      { title: 'Servernachricht', text: 'Neue Serverrunde' },
    ]);
    const log = await call('POST', '/api/admin/events', {
      action: 'announce',
      outcome: 'ok',
    });
    expect(log.json?.events).toMatchObject([
      { detail: '{"recipients":2}', actor: 'u_Boss' },
    ]);
    await call('POST', '/api/login', {
      name: 'Pilot',
      password: 'secret1',
      remember: false,
    });
    expect(
      (await call('POST', '/api/admin/announce', { message: 'Nein' })).status,
    ).toBe(400);
  });

  it('shows actions and orders, estimates activity and revokes access on suspension', async () => {
    const { ctx, call, setCookie } = await asAdmin();
    const boss = (
      await call('POST', '/api/login', { name: 'Boss', password: 'secret1' })
    ).set!.split(';')[0]!;
    const u = addUser(ctx, 'Pilot');
    addPlanet(ctx, u.id, { p: 6 });
    const login = { name: 'Pilot', password: 'secret1' };
    const session = (await call('POST', '/api/login', login)).set!.split(
      ';',
    )[0]!;
    await call('POST', '/api/activity', {});
    ctx.clock.t += 20000;
    await call('POST', '/api/activity', {});
    ctx.clock.t += 360000;
    await call('GET', '/api/state');
    const build = await call('POST', '/api/action', {
      type: 'build',
      key: 'metal',
    });
    expect(build.status).toBe(200);
    const rejected = await call('POST', '/api/action', { type: 'bad-action' });
    expect(rejected.status).toBe(400);
    setCookie(boss);
    expect(
      (await call('POST', '/api/admin/player', { player: u.id })).json,
    ).toMatchObject({
      suspension: null,
      days: [{ activeMs: 20000, actions: 1 }],
    });
    expect(
      (await call('POST', '/api/admin/orders', { player: u.id })).json!.orders,
    ).toMatchObject([
      { kind: 'Gebäude', player: u.id, item: 'metal', id: 'p1_1_6' },
    ]);
    const log = await call('POST', '/api/admin/events', { player: u.id });
    expect(log.json!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'build',
          outcome: 'ok',
          requestId: build.headers.get('x-request-id'),
        }),
        expect.objectContaining({
          action: 'unknown',
          outcome: 'rejected',
          requestId: rejected.headers.get('x-request-id'),
        }),
      ]),
    );
    const moderation = { player: u.id, reason: 'Support investigation' };
    expect(
      (
        await call('POST', '/api/admin/moderate', {
          ...moderation,
          action: 'ban',
          hours: 721,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call('POST', '/api/admin/moderate', {
          ...moderation,
          action: 'ban',
          hours: 1,
        })
      ).status,
    ).toBe(200);
    setCookie(session);
    expect((await call('GET', '/api/state')).status).toBe(401);
    expect((await call('POST', '/api/login', login)).status).toBe(400);
    setCookie(boss);
    expect(
      (
        await call('POST', '/api/admin/moderate', {
          ...moderation,
          action: 'unban',
        })
      ).status,
    ).toBe(200);
    expect((await call('POST', '/api/login', login)).status).toBe(200);
    setCookie(boss);
    expect(
      (
        await call('POST', '/api/admin/moderate', {
          ...moderation,
          action: 'revokeSessions',
        })
      ).status,
    ).toBe(200);
    const changes = await call('POST', '/api/admin/events', {
      player: u.id,
      action: 'ban',
      outcome: 'ok',
    });
    expect(changes.json!.events).toMatchObject([
      {
        actor: 'u_Boss',
        category: 'admin.write',
        target: u.id,
        detail: expect.stringContaining('Support investigation'),
      },
    ]);
  });

  it('revokes invitations as admin only', async () => {
    const { ctx, call } = await asAdmin();
    await call('POST', '/api/admin/invite', { email: 'a@example.org' });
    const id = ctx.invitations.open(ctx.now())[0]!.id;
    const r = await call('POST', '/api/admin/revoke', { id });
    expect(r.json).toMatchObject({ ok: true, msg: 'Einladung widerrufen.' });
    expect(ctx.invitations.open(ctx.now())).toEqual([]);
    ctx.players.save({ ...ctx.players.byName('Boss')!, admin: false });
    expect((await call('POST', '/api/admin/revoke', {})).json).toEqual({
      error: 'Nur der Admin darf das.',
    });
  });

  it('answers 500 without details on an unexpected error', async () => {
    const logs: string[] = [];
    const { ctx, call } = await start({ logs });
    ctx.db.close();
    const r = await call('GET', '/healthz');
    expect(r).toMatchObject({ status: 500, json: { error: 'Serverfehler.' } });
    // The error log cannot be written either; that is logged, never thrown.
    expect(logs).toEqual([
      expect.stringMatching(/^Request failed \[/),
      'Error log write failed',
    ]);
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

describe('account security', () => {
  it('deletes the authenticated account and its guild, preserving other accounts', async () => {
    const { call, ctx, cfg, setCookie } = await asAdmin();
    const boss = ctx.players.byName('Boss')!;
    const member = addUser(ctx, 'Member');
    addPlanet(ctx, member.id, { p: 8 });
    ctx.db
      .prepare("INSERT INTO guilds VALUES ('g', 'TAG', 'Guild', '', ?)")
      .run(boss.id);
    ctx.db
      .prepare("INSERT INTO guild_members VALUES (?, 'g', 'member')")
      .run(boss.id);
    ctx.db
      .prepare("INSERT INTO guild_members VALUES (?, 'g', 'member')")
      .run(member.id);
    ctx.reports.add(
      member.id,
      {
        id: 'related',
        title: 'Shared report',
        time: 1,
        type: 'info',
        participants: [boss.id, member.id],
      },
      10,
    );
    ctx.reports.add(
      member.id,
      { id: 'unrelated', title: 'Other report', time: 2, type: 'info' },
      10,
    );
    const other = startSession(ctx, cfg, boss.id);
    expect(
      (await call('POST', '/api/account/delete', { password: 'wrong' })).status,
    ).toBe(400);
    expect(ctx.players.get(boss.id)).not.toBeNull();
    const result = await call('POST', '/api/account/delete', {
      password: 'secret1',
    });
    expect(result.set).toContain('Max-Age=0');
    expect(ctx.players.get(boss.id)).toBeNull();
    expect(ctx.planets.home(boss.id)).toBeNull();
    expect(ctx.players.get(member.id)).not.toBeNull();
    expect(ctx.reports.ofPlayer(member.id).map(({ id }) => id)).toEqual([
      'unrelated',
    ]);
    expect(ctx.db.prepare('SELECT * FROM guilds').all()).toEqual([]);
    expect(ctx.db.prepare('SELECT * FROM guild_members').all()).toEqual([]);
    expect(
      ctx.db.prepare('SELECT * FROM audit_events WHERE actor = ?').all(boss.id),
    ).toEqual([]);
    setCookie(`${COOKIE}=${other}`);
    expect((await call('GET', '/api/state')).status).toBe(401);
  });

  it('binds passkey registration to the verified session and consumes login challenges once', async () => {
    const { call, ctx, cfg, setCookie } = await asAdmin();
    const optionsPath = '/api/passkeys/register/options';
    expect(
      (await call('POST', optionsPath, { password: 'wrong' })).status,
    ).toBe(400);
    const registration = await call('POST', optionsPath, {
      password: 'secret1',
    });
    expect(registration.status).toBe(200);
    const admin = ctx.players.byName('Boss')!;
    setCookie(`${COOKIE}=${startSession(ctx, cfg, admin.id)}`);
    const body = { ceremony: registration.json?.ceremony, response: {} };
    expect((await call('POST', '/api/passkeys/register', body)).status).toBe(
      400,
    );
    expect(
      ctx.db.prepare('SELECT COUNT(*) AS n FROM passkey_challenges').get(),
    ).toEqual({ n: 1 });
    const login = await call('POST', '/api/passkeys/login/options', {});
    const answer = { ceremony: login.json?.ceremony, response: {} };
    expect((await call('POST', '/api/passkeys/login', answer)).status).toBe(
      400,
    );
    expect((await call('POST', '/api/passkeys/login', answer)).status).toBe(
      400,
    );
    expect(
      ctx.db.prepare('SELECT COUNT(*) AS n FROM passkey_challenges').get(),
    ).toEqual({ n: 1 });
  });

  it('revokes an outstanding email login code when an admin suspends the account', async () => {
    const mails: Mail[] = [];
    const { ctx, cfg, call, setCookie } = await start({
      cfg: { emailLoginCodes: true },
      mailer: async (mail) => {
        mails.push(mail);
      },
    });
    const admin = addUser(ctx, 'Boss', { admin: true });
    const pilot = addUser(ctx, 'Pilot');
    const login = { name: pilot.name, password: 'secret1' };
    const pending = await call('POST', '/api/login', login);
    expect(pending.status).toBe(200);
    const code = /\b\d{6}\b/.exec(mails[0]!.text)![0];
    setCookie(`${COOKIE}=${startSession(ctx, cfg, admin.id)}`);
    const body = { player: pilot.id, reason: 'Support review' };
    expect(
      (await call('POST', '/api/admin/moderate', { ...body, action: 'ban' }))
        .status,
    ).toBe(200);
    expect(
      (await call('POST', '/api/admin/moderate', { ...body, action: 'unban' }))
        .status,
    ).toBe(200);
    setCookie('');
    const reply = await call('POST', '/api/login/code', {
      challenge: pending.json!.challenge,
      code,
    });
    expect(reply.status).toBe(400);
    expect(reply.set).toBeNull();
  });

  it('requires a single-use code and limits guesses', async () => {
    const mails: Mail[] = [];
    const { ctx, call } = await start({
      cfg: { emailLoginCodes: true },
      mailer: async (mail) => {
        mails.push(mail);
      },
    });
    addUser(ctx, 'Anna');
    const login = () =>
      call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const begin = await login();
    expect(begin.set).toBeNull();
    expect((await call('GET', '/api/state')).status).toBe(401);
    const code = /\b\d{6}\b/.exec(mails[0]!.text)![0];
    const verify = (challenge: unknown, value: string) =>
      call('POST', '/api/login/code', { challenge, code: value });
    for (let i = 0; i < 5; i++)
      expect((await verify(begin.json?.challenge, 'invalid')).status).toBe(400);
    expect((await verify(begin.json?.challenge, code)).status).toBe(400);
    const retry = await login();
    const newCode = /\b\d{6}\b/.exec(mails[1]!.text)![0];
    expect((await verify(retry.json?.challenge, newCode)).set).toContain(
      'nova_session=',
    );
    expect((await verify(retry.json?.challenge, newCode)).status).toBe(400);
  });

  it('gives a uniform reset response and invalidates sessions and the link', async () => {
    const mails: Mail[] = [];
    const { ctx, call } = await start({
      mailer: async (mail) => {
        mails.push(mail);
      },
    });
    addUser(ctx, 'Anna');
    await call('POST', '/api/login', { name: 'Anna', password: 'secret1' });
    const ask = (email: string) =>
      call('POST', '/api/password/forgot', { email });
    const unknown = await ask('unknown@example.org');
    const known = await ask('anna@example.org');
    expect(known.json).toEqual(unknown.json);
    await expect.poll(() => mails.length).toBe(1);
    await ask('anna@example.org');
    const token = /#reset=([\w-]+)/.exec(mails[0]!.text)![1];
    const update = () =>
      call('POST', '/api/password/reset', {
        token,
        password: 'a new secure passphrase',
      });
    expect((await update()).status).toBe(200);
    expect((await update()).status).toBe(400);
    expect(ctx.db.prepare('SELECT * FROM sessions').all()).toEqual([]);
    expect(
      (await call('POST', '/api/login', { name: 'Anna', password: 'secret1' }))
        .status,
    ).toBe(400);
    expect(
      (
        await call('POST', '/api/login', {
          name: 'Anna',
          password: 'a new secure passphrase',
        })
      ).status,
    ).toBe(200);
    expect(mails).toHaveLength(1);
  });

  it('uses the configured minimum for registration, password change and reset', async () => {
    const mails: Mail[] = [];
    const { call, setCookie } = await asAdmin({
      cfg: { passwordMinLength: 10 },
      mailer: async (mail) => void mails.push(mail),
    });
    expect((await call('GET', '/api/account/policy')).json).toEqual({
      passwordMinLength: 10,
    });
    const invite = await call('POST', '/api/admin/invite', {
      email: 'policy@example.org',
    });
    const token = String(invite.json?.link).split('#invite=')[1];
    setCookie('');
    const registration = { token, name: 'Policy', planet: 'P', gal: 1 };
    const short = '123456789';
    const first = '1234567890';
    expect(
      (
        await call('POST', '/api/register', {
          ...registration,
          password: short,
        })
      ).json?.error,
    ).toContain('mindestens 10 Zeichen');
    expect(
      (
        await call('POST', '/api/register', {
          ...registration,
          password: first,
        })
      ).status,
    ).toBe(200);
    const change = (password: string) =>
      call('POST', '/api/password/change', {
        current: first,
        password,
        confirmation: password,
      });
    expect((await change(short)).json?.error).toContain(
      'mindestens 10 Zeichen',
    );
    expect((await change('abcdefghij')).status).toBe(200);
    await call('POST', '/api/password/forgot', { email: 'policy@example.org' });
    await expect.poll(() => mails.length).toBe(2);
    const reset = /#reset=([\w-]+)/.exec(mails[1]!.text)![1];
    expect(
      (
        await call('POST', '/api/password/reset', {
          token: reset,
          password: short,
        })
      ).json?.error,
    ).toContain('mindestens 10 Zeichen');
    expect(
      (
        await call('POST', '/api/password/reset', {
          token: reset,
          password: first,
        })
      ).status,
    ).toBe(200);
  });

  it('rejects expired reset links and purges expired account tokens', async () => {
    const mails: Mail[] = [];
    const { ctx, call, app } = await start({
      mailer: async (mail) => {
        mails.push(mail);
      },
    });
    addUser(ctx, 'Anna');
    await call('POST', '/api/password/forgot', { email: 'anna@example.org' });
    await expect.poll(() => mails.length).toBe(1);
    const token = /#reset=([\w-]+)/.exec(mails[0]!.text)![1];
    ctx.clock.t += 30 * 60_000;
    const result = await call('POST', '/api/password/reset', {
      token,
      password: 'another test passphrase',
    });
    expect(result.status).toBe(400);
    app.sweep();
    expect(ctx.db.prepare('SELECT * FROM account_tokens').all()).toEqual([]);
  });

  it('requires the current password to change it and signs out existing sessions', async () => {
    const { call } = await asAdmin();
    const change = (
      current: string,
      confirmation = 'another test passphrase',
    ) =>
      call('POST', '/api/password/change', {
        current,
        confirmation,
        password: 'another test passphrase',
      });
    expect((await change('wrong')).status).toBe(400);
    expect(
      (await change('secret1', 'different test passphrase')).json?.error,
    ).toContain('stimmen nicht überein');
    expect((await change('secret1')).status).toBe(200);
    expect((await call('GET', '/api/state')).status).toBe(401);
    expect(
      (
        await call('POST', '/api/login', {
          name: 'Boss',
          password: 'another test passphrase',
        })
      ).status,
    ).toBe(200);
  });
});

describe('admin routes', () => {
  const audit = (ctx: TestCtx) =>
    ctx.db
      .prepare(
        'SELECT category, action, target, outcome, detail FROM audit_events ORDER BY id',
      )
      .all() as {
      category: string;
      action: string;
      target: string | null;
      outcome: string;
      detail: string;
    }[];

  it('audits every read with its target and filter', async () => {
    const { call, ctx } = await asAdmin();
    const stats = await call('POST', '/api/admin/stats', {});
    expect(stats.json).toEqual({
      players: expect.arrayContaining([
        expect.objectContaining({ id: 'u_Boss' }),
      ]),
    });
    expect(
      (await call('POST', '/api/admin/orders', { reference: 'p1' })).json,
    ).toEqual({ orders: [], now: ctx.now() });
    await call('POST', '/api/admin/orders', { player: 'u_Boss' });
    await call('POST', '/api/admin/events', { limit: 25 });
    await call('POST', '/api/admin/events', { player: 'u_Boss' });
    const rows = audit(ctx).filter((r) => r.category === 'admin.read');
    expect(rows.map(({ action, target }) => ({ action, target }))).toEqual([
      { action: 'stats', target: null },
      { action: 'orders', target: null },
      { action: 'orders', target: 'u_Boss' },
      { action: 'events', target: null },
      { action: 'events', target: 'u_Boss' },
    ]);
    expect(JSON.parse(rows[1]!.detail)).toEqual({ reference: 'p1' });
    expect(JSON.parse(rows[3]!.detail)).toMatchObject({
      page: 1,
      limit: 25,
      player: '',
    });
  });

  it('names the reason when a player, an action or an invitation is unknown', async () => {
    const { call, ctx } = await asAdmin();
    for (const [url, body, msg] of [
      ['/api/admin/player', { player: 'nobody' }, 'Spieler nicht gefunden.'],
      ['/api/admin/moderate', { action: 'delete' }, 'Unbekannte Aktion.'],
      [
        '/api/admin/revoke',
        { id: 'missing' },
        'Einladung nicht gefunden oder bereits widerrufen.',
      ],
    ] as const) {
      const r = await call('POST', url, body);
      expect(r.status).toBe(400);
      expect(r.json).toEqual({ error: msg });
    }
    expect(
      audit(ctx)
        .filter((r) => r.category.startsWith('admin'))
        .map(({ category, action, outcome }) => ({
          category,
          action,
          outcome,
        })),
    ).toEqual([
      { category: 'admin.read', action: 'player', outcome: 'rejected' },
      { category: 'admin.write', action: 'revoke', outcome: 'rejected' },
    ]);
  });

  it('answers a moderation with ok and audits an announcement as a write', async () => {
    const { call, ctx } = await asAdmin();
    addUser(ctx, 'Target');
    expect(
      (
        await call('POST', '/api/admin/moderate', {
          action: 'revokeSessions',
          player: 'u_Target',
          reason: 'Test',
        })
      ).json,
    ).toEqual({ ok: true });
    expect(
      (await call('POST', '/api/admin/announce', { message: 'Hallo' })).json,
    ).toEqual({ recipients: 2 });
    expect(
      audit(ctx)
        .filter((r) => r.category.startsWith('admin'))
        .map(({ category, action, target }) => ({
          category,
          action,
          target,
        })),
    ).toEqual([
      {
        category: 'admin.write',
        action: 'revokeSessions',
        target: 'u_Target',
      },
      { category: 'admin.write', action: 'announce', target: null },
    ]);
  });
});
