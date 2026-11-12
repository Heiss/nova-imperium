import { describe, expect, it, vi } from 'vitest';
import { RateLimiter } from './rate-limit.ts';
import { asAdmin, start } from '../../test/http.ts';
import { unzipLines } from '../../test/zip.ts';
import { DAY } from '../audit.ts';
import { addPlanet, addUser } from '../test-helpers.ts';

const NEWS = { version: '26.11.21', versions: [] };
const BODY = { kind: 'error', message: 'TypeError: x', page: 'fleet' };

async function player(over: Parameters<typeof start>[0] = {}) {
  const s = await start({ news: NEWS, ...over });
  addUser(s.ctx, 'Anna');
  addPlanet(s.ctx, 'u_Anna');
  const login = await s.call('POST', '/api/login', {
    name: 'Anna',
    password: 'secret1',
  });
  expect(login.status).toBe(200);
  return s;
}

const errorRows = (ctx: { store: { db: import('better-sqlite3').Database } }) =>
  ctx.store.db
    .prepare('SELECT * FROM error_events ORDER BY id')
    .all() as Record<string, unknown>[];

const auditOf = (
  ctx: { store: { db: import('better-sqlite3').Database } },
  action: string,
) =>
  ctx.store.db
    .prepare(
      'SELECT actor, category, outcome, detail FROM audit_events WHERE action = ?',
    )
    .all(action) as Record<string, unknown>[];

describe('browser errors', () => {
  it('records nothing without a session (the login page)', async () => {
    const { ctx, call } = await start();
    const r = await call('POST', '/api/errors', BODY);
    expect(r).toMatchObject({
      status: 401,
      json: { error: 'Bitte einloggen.' },
    });
    expect((await call('POST', '/api/report', { text: 'x' })).status).toBe(401);
    expect(errorRows(ctx)).toEqual([]);
  });

  it('stores no version when neither the browser nor the server has one', async () => {
    const { ctx, call } = await player({ news: undefined });
    await call('POST', '/api/errors', BODY);
    expect(errorRows(ctx)).toMatchObject([{ version: '' }]);
  });

  it('records an error of a signed-in player with the server version', async () => {
    const { ctx, call } = await player();
    expect((await call('POST', '/api/errors', BODY)).json).toEqual({
      ok: true,
    });
    expect(errorRows(ctx)).toMatchObject([
      {
        kind: 'client',
        player: 'u_Anna',
        action: 'error',
        page: 'fleet',
        version: '26.11.21',
        count: 1,
      },
    ]);
    expect((await call('POST', '/api/errors', { kind: 'x' })).json).toEqual({
      error: 'Unbekannte Fehlerart.',
    });
    const foreign = await call('POST', '/api/errors', BODY, {
      origin: 'https://evil.example',
    });
    expect(foreign.status).toBe(403);
    expect(errorRows(ctx)).toMatchObject([{ count: 1 }]);
    await call('POST', '/api/errors', BODY);
    expect(errorRows(ctx)).toMatchObject([{ count: 2 }]);
  });

  it('takes 20 a minute and 200 a day per player; refused ones do not count', async () => {
    const { ctx, call } = await player();
    ctx.clock.t = 10 * DAY;
    const send = async () => (await call('POST', '/api/errors', BODY)).status;
    for (let i = 0; i < 20; i++) expect(await send()).toBe(200);
    const refused = await call('POST', '/api/errors', BODY);
    expect(refused).toMatchObject({
      status: 429,
      json: { error: 'Zu viele Fehlermeldungen.' },
    });
    expect(await send()).toBe(429);
    for (let minute = 1; minute < 10; minute++) {
      ctx.clock.t += 60000;
      for (let i = 0; i < 20; i++) expect(await send()).toBe(200);
    }
    ctx.clock.t += 60000;
    expect(await send()).toBe(429);
    expect(errorRows(ctx)).toMatchObject([{ count: 200 }]);
    ctx.clock.t = 11 * DAY;
    expect(await send()).toBe(200);
  });

  it('counts the limits per player', async () => {
    const { ctx, call, setCookie } = await player();
    for (let i = 0; i < 20; i++) await call('POST', '/api/errors', BODY);
    expect((await call('POST', '/api/errors', BODY)).status).toBe(429);
    setCookie('');
    addUser(ctx, 'Bert');
    await call('POST', '/api/login', { name: 'Bert', password: 'secret1' });
    expect((await call('POST', '/api/errors', BODY)).status).toBe(200);
  });
});

describe('problem reports', () => {
  it('thanks the player and takes 5 an hour; an empty text does not count', async () => {
    const { ctx, call } = await player();
    const report = (text = 'Die Flotte ist weg.') =>
      call('POST', '/api/report', { text, page: 'fleet', source: 'toast' });
    expect((await report('  ')).json).toEqual({
      error: 'Bitte beschreibe kurz, was passiert ist.',
    });
    for (let i = 0; i < 5; i++)
      expect((await report()).json).toEqual({
        ok: true,
        msg: 'Danke, die Meldung ist angekommen.',
      });
    expect((await report()).json).toEqual({
      error: 'Zu viele Meldungen – bitte in einer Stunde nochmal.',
    });
    expect(errorRows(ctx)).toHaveLength(5);
    expect(errorRows(ctx)[0]).toMatchObject({
      kind: 'report',
      player: 'u_Anna',
      action: 'toast',
      page: 'fleet',
      version: '26.11.21',
      report: 'Die Flotte ist weg.',
    });
    ctx.clock.t += 3600000;
    expect((await report()).status).toBe(200);
  });

  it('sweeps all its limit windows with the app', async () => {
    const sweep = vi.spyOn(RateLimiter.prototype, 'sweep');
    const { app } = await player();
    app.sweep();
    // The login limit and the three windows of the error log.
    expect(sweep).toHaveBeenCalledTimes(4);
    sweep.mockRestore();
  });

  it('forgets old limit windows in the sweep', async () => {
    const { ctx, call, app } = await player();
    for (let i = 0; i < 5; i++)
      await call('POST', '/api/report', { text: 'x' });
    for (let i = 0; i < 20; i++) await call('POST', '/api/errors', BODY);
    ctx.clock.t += DAY;
    app.sweep();
    expect((await call('POST', '/api/report', { text: 'x' })).status).toBe(200);
    expect((await call('POST', '/api/errors', BODY)).status).toBe(200);
  });
});

describe('server errors', () => {
  it('records a 500 with route, request ID, player and version, never the body', async () => {
    const logs: string[] = [];
    const { ctx, call } = await player({ logs });
    vi.spyOn(ctx.store, 'universe').mockImplementation(() => {
      throw new Error('failed for anna@example.org with password=hunter2');
    });
    const r = await call('POST', '/api/action?x=1', {
      type: 'rename',
      name: 'geheim-body-text',
      password: 'body-password',
    });
    expect(r).toMatchObject({ status: 500, json: { error: 'Serverfehler.' } });
    const requestId = r.headers.get('x-request-id');
    expect(logs).toEqual([`Request failed [${requestId}]`]);
    const [row] = errorRows(ctx);
    expect(row).toMatchObject({
      kind: 'server',
      action: 'POST /api/action',
      request_id: requestId,
      player: 'u_Anna',
      version: '26.11.21',
      message: 'Error: failed for [email] with password=[redacted]',
    });
    const stored = JSON.stringify(errorRows(ctx));
    for (const secret of ['anna@', 'hunter2', 'geheim-body-text', 'body-pass'])
      expect(stored).not.toContain(secret);
  });

  it('records a 500 without a valid session as without a player', async () => {
    const { ctx, call, setCookie } = await start();
    const prepare = ctx.store.db.prepare.bind(ctx.store.db);
    vi.spyOn(ctx.store.db, 'prepare').mockImplementation((sql: string) => {
      if (sql === 'SELECT 1') throw new Error('boom');
      return prepare(sql);
    });
    setCookie('nova_session=unknown');
    expect((await call('GET', '/healthz')).status).toBe(500);
    expect(errorRows(ctx)).toMatchObject([
      { action: 'GET /healthz', player: null, version: '' },
    ]);
  });

  it('records a failed reset mail as a background job', async () => {
    const logs: string[] = [];
    const s = await start({
      news: NEWS,
      logs,
      mailer: () => Promise.reject(new Error('SMTP refused anna@example.org')),
    });
    addUser(s.ctx, 'Anna');
    await s.call('POST', '/api/password/forgot', { email: 'anna@example.org' });
    await vi.waitFor(() => expect(errorRows(s.ctx)).toHaveLength(1));
    expect(logs).toEqual(['Password reset mail failed']);
    expect(errorRows(s.ctx)[0]).toMatchObject({
      kind: 'server',
      action: 'mail',
      version: '26.11.21',
      message: 'Error: SMTP refused [email]',
    });
  });
});

describe('admin tab „Fehler“', () => {
  it('lists errors for the admin only and audits the read', async () => {
    const s = await asAdmin({ news: NEWS });
    const { ctx, call } = s;
    addUser(ctx, 'Anna');
    ctx.store.db
      .prepare(
        `INSERT INTO error_events (kind, time, first, player, action, page,
          version, browser, message, detail, report)
         VALUES ('report', 1, 1, 'u_Anna', 'form', 'help', '', '', '', '', 'Hilfe')`,
      )
      .run();
    const list = await call('POST', '/api/admin/errors', { kind: 'report' });
    expect(list.json).toMatchObject({
      page: 1,
      pages: 1,
      count: 1,
      limit: 10,
      errors: [{ kind: 'report', playerName: 'Anna', report: 'Hilfe' }],
    });
    expect(auditOf(ctx, 'errors')).toEqual([
      {
        actor: 'u_Boss',
        category: 'admin.read',
        outcome: 'ok',
        detail: JSON.stringify({ kind: 'report', page: 1 }),
      },
    ]);
    ctx.store.saveUser({ ...ctx.store.userByName('Boss')!, admin: false });
    expect((await call('POST', '/api/admin/errors', {})).json).toEqual({
      error: 'Nur der Admin darf das.',
    });
    s.setCookie('');
    expect((await call('POST', '/api/admin/errors', {})).status).toBe(401);
  });

  it('downloads the ZIP for the admin only and audits it as an admin read', async () => {
    const s = await asAdmin({ news: NEWS });
    const { ctx, call } = s;
    ctx.clock.t = 20 * DAY;
    addUser(ctx, 'Anna');
    await call('POST', '/api/admin/stats', {});
    ctx.store.db
      .prepare(
        `INSERT INTO error_events (kind, time, first, player, action, page,
          version, browser, message, detail, report)
         VALUES ('client', ?, ?, 'u_Anna', 'error', 'fleet', '', '', 'm', '', '')`,
      )
      .run(ctx.now(), ctx.now());
    const r = await call('POST', '/api/admin/errors/download', {});
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/zip');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('content-disposition')).toBe(
      'attachment; filename="nova-imperium-fehler-1970-01-14-1970-01-21.zip"',
    );
    expect(r.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const files = unzipLines(r.bytes);
    expect(files['errors.jsonl']).toMatchObject([
      { kind: 'client', player: 'Anna', message: 'm' },
    ]);
    expect(files['reports.jsonl']).toEqual([]);
    expect(files['audit.jsonl']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'stats', actor: 'Boss' }),
      ]),
    );
    const [first] = auditOf(ctx, 'errorDownload');
    expect(first).toMatchObject({ actor: 'u_Boss', category: 'admin.read' });
    expect(JSON.parse(String(first!.detail))).toEqual({
      since: 13 * DAY,
      until: 20 * DAY,
      errors: 1,
      reports: 0,
      audit: 1,
    });

    const narrow = await call('POST', '/api/admin/errors/download', {
      since: 1,
      until: 2,
    });
    expect(unzipLines(narrow.bytes)['errors.jsonl']).toEqual([]);

    ctx.store.saveUser({ ...ctx.store.userByName('Boss')!, admin: false });
    const refused = await call('POST', '/api/admin/errors/download', {});
    expect(refused).toMatchObject({
      status: 400,
      json: { error: 'Nur der Admin darf das.' },
    });
    expect(refused.headers.get('content-type')).not.toBe('application/zip');
    s.setCookie('');
    expect((await call('POST', '/api/admin/errors/download', {})).status).toBe(
      401,
    );
    expect(auditOf(ctx, 'errorDownload')).toHaveLength(2);
  });
});
