import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ERROR_FIELDS } from '../core/error-log.ts';
import { DAY, purgeAudit } from './audit.ts';
import { deleteAccount } from './delete-account.ts';
import {
  clean,
  errorPage,
  noteServerError,
  readReport,
  recordClientError,
  recordReport,
  recordServerError,
  scrub,
} from './error-log.ts';
import { GameError } from './game/context.ts';
import { addUser, testCtx, type TestCtx } from './test-helpers.ts';

const ID = '0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
// A 43-character token like an invitation token, made at run time so the
// history holds no secret-looking literal (gitleaks).
const TOKEN = randomBytes(32).toString('base64url');

const rows = (ctx: TestCtx) =>
  ctx.store.db
    .prepare('SELECT * FROM error_events ORDER BY id')
    .all() as Record<string, unknown>[];

describe('scrub', () => {
  it('removes values of fields that hint at secrets', () => {
    expect(scrub('password=hunter2 and name=Anna')).toBe(
      'password=[redacted] and name=Anna',
    );
    expect(scrub('{"pw_hash":"abc","passwort": \'x y\'}')).toBe(
      '{"pw_hash":[redacted],"passwort": [redacted]}',
    );
    expect(scrub('Cookie: nova_session=abc; theme=dark')).toBe(
      'Cookie: [redacted]; theme=dark',
    );
    expect(
      scrub('token=a&code=123&challenge=c&secret=s&salt=s&auth=a&email=x'),
    ).toBe(
      'token=[redacted]&code=[redacted]&challenge=[redacted]&secret=[redacted]&salt=[redacted]&auth=[redacted]&email=[redacted]',
    );
    expect(scrub('(SESSION: x) [e-mail=y]')).toBe(
      '(SESSION: [redacted]) [e-mail=[redacted]]',
    );
    // Only a name that ends a word run counts; a value without : or = stays.
    expect(scrub('Session expired; xtoken')).toBe('Session expired; xtoken');
  });

  it('removes email addresses but keeps scoped packages and paths', () => {
    expect(scrub('mail to anna.b+1@example.org failed')).toBe(
      'mail to [email] failed',
    );
    expect(scrub('<bert@mail.example.com>, (c@d.de)')).toBe(
      '<[email]>, ([email])',
    );
    expect(scrub('at node_modules/@simplewebauthn/server/x.js')).toBe(
      'at node_modules/@simplewebauthn/server/x.js',
    );
    expect(scrub('user@localhost')).toBe('user@localhost');
  });

  it('removes tokens and hashes, keeps request IDs, names and short ids', () => {
    expect(scrub(`#invite=${TOKEN} x`)).toBe('#invite=[token] x');
    expect(scrub(`reset ${'ab12'.repeat(16)}`)).toBe('reset [token]');
    expect(scrub(`Request failed [${ID}]`)).toBe(`Request failed [${ID}]`);
    expect(scrub('at process.processTicksAndRejections (node:x)')).toBe(
      'at process.processTicksAndRejections (node:x)',
    );
    expect(scrub('SQLITE_CONSTRAINT_FOREIGNKEY fleet aB3dE5gH7jK9')).toBe(
      'SQLITE_CONSTRAINT_FOREIGNKEY fleet aB3dE5gH7jK9',
    );
    expect(scrub('a1b2c3d4e5f6g7h8i9j0')).toBe('[token]');
    expect(scrub('a1b2c3d4e5f6g7h8i9j')).toBe('a1b2c3d4e5f6g7h8i9j');
    expect(scrub('abcdefghijklmnopqrstuvwxyzabcdef')).toBe('[token]');
    expect(scrub('abcdefghijklmnopqrstuvwxyzabcde')).toBe(
      'abcdefghijklmnopqrstuvwxyzabcde',
    );
    expect(scrub('11111111111111111111')).toBe('11111111111111111111');
    expect(scrub(`${ID}0`)).toBe('[token]');
    expect(scrub(`0${ID}`)).toBe('[token]');
  });

  it('removes six-digit codes, not stack positions or longer numbers', () => {
    expect(scrub('Dein Code 123456.')).toBe('Dein Code [code].');
    // A code before a colon is still a code (CodeRabbit on #128).
    expect(scrub('123456: it failed')).toBe('[code]: it failed');
    expect(scrub('(app.js:1:123456)')).toBe('(app.js:1:123456)');
    expect(scrub('at file.ts:123456:7')).toBe('at file.ts:123456:7');
    expect(scrub('at 1.123456 and x123456 and 123456x')).toBe(
      'at 1.123456 and x123456 and 123456x',
    );
    expect(scrub('1234567 12345')).toBe('1234567 12345');
  });

  it('removes values after short and German password names (#128)', () => {
    expect(scrub('pw=secret1 and pwd: x')).toBe(
      'pw=[redacted] and pwd: [redacted]',
    );
    expect(scrub('passwd=a kennwort=b Kennwort: c')).toBe(
      'passwd=[redacted] kennwort=[redacted] Kennwort: [redacted]',
    );
  });
});

describe('clean', () => {
  it('cuts, trims and removes control characters', () => {
    expect(clean(' a\u0000\nb\t ', 10)).toBe('a b');
    expect(clean('a\u0000\nb\t\u0007c', 10, true)).toBe('a\nb\tc');
    expect(clean('abcdef', 3)).toBe('abc');
    expect(clean(42, 10)).toBe('');
    expect(clean(undefined, 10)).toBe('');
  });

  it('scrubs a secret that crosses the limit before it cuts', () => {
    const text = 'x '.repeat(47) + 'x anna@example.org';
    expect(clean(text, 100)).toBe('x '.repeat(47) + 'x [ema');
    expect(clean(text, 100)).not.toContain('anna');
  });

  it('stays fast on long input without separators', () => {
    const start = performance.now();
    clean('a-'.repeat(40000) + '@', ERROR_FIELDS.detail, true);
    clean('token'.repeat(20000), ERROR_FIELDS.detail);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('server errors', () => {
  it('stores route, player, request ID, version, message and stack', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    const error = new TypeError('broken for anna@example.org');
    recordServerError(ctx, {
      action: 'POST /api/action',
      error,
      player: u.id,
      requestId: ID,
      version: '26.11.21',
    });
    expect(rows(ctx)).toEqual([
      {
        id: 1,
        kind: 'server',
        time: ctx.now(),
        first: ctx.now(),
        player: u.id,
        request_id: ID,
        action: 'POST /api/action',
        page: '',
        version: '26.11.21',
        browser: '',
        message: 'TypeError: broken for [email]',
        detail: expect.stringMatching(
          /^TypeError: broken for \[email\]\n {4}at /,
        ),
        count: 1,
        report: '',
      },
    ]);
  });

  it('names the context, accepts anything thrown and drops unknown values', () => {
    const ctx = testCtx();
    recordServerError(ctx, {
      action: 'arrival',
      error: 'plain',
      context: 'Fleet f1 failed and was removed',
      player: 'u_nobody',
      requestId: 'not-an-id',
    });
    const noStack = new Error('no stack');
    noStack.stack = undefined;
    recordServerError(ctx, { action: 'tick', error: noStack });
    expect(rows(ctx)).toMatchObject([
      {
        action: 'arrival',
        message: 'Fleet f1 failed and was removed: plain',
        detail: '',
        player: null,
        request_id: null,
        version: '',
      },
      { action: 'tick', message: 'Error: no stack', detail: '' },
    ]);
  });

  it('takes only a request ID that is exactly a UUID string', () => {
    const ctx = testCtx();
    const ids = [ID, `x${ID}`, `${ID}x`, [ID], { toString: () => ID }];
    for (const requestId of ids)
      recordServerError(ctx, {
        action: 'x',
        error: 'y',
        requestId: requestId as string,
      });
    expect(rows(ctx).map((r) => r.request_id)).toEqual([
      ID,
      null,
      null,
      null,
      null,
    ]);
  });

  it('logs a failed write instead of throwing', () => {
    const ctx = testCtx();
    const log = vi.fn();
    ctx.store.db.close();
    expect(() =>
      noteServerError(ctx, { action: 'x', error: new Error('y') }, log),
    ).not.toThrow();
    expect(log).toHaveBeenCalledWith(
      'Error log write failed',
      expect.any(Error),
    );
    expect(() =>
      noteServerError(ctx, { action: 'x', error: new Error('y') }),
    ).not.toThrow();
  });

  it('records through noteServerError while the database works', () => {
    const ctx = testCtx();
    const log = vi.fn();
    noteServerError(ctx, { action: 'sweep', error: new Error('y') }, log);
    expect(rows(ctx)).toMatchObject([{ action: 'sweep' }]);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('browser errors', () => {
  const body = {
    kind: 'error',
    message: 'TypeError: x is undefined',
    detail: 'at render (app.js:1:2)\nat tick (app.js:3:4)',
    page: 'fleet',
    version: '26.11.21',
    browser: 'Firefox',
    requestId: ID,
  };

  it('stores every field, limited and scrubbed', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    recordClientError(ctx, u, body, '26.11.20');
    recordClientError(
      ctx,
      u,
      {
        kind: 'api',
        message: 'm '.repeat(300),
        detail: 'd\n'.repeat(2500),
        page: 'p '.repeat(25),
        version: '',
        browser: `b ${TOKEN} ` + 'b '.repeat(150),
        requestId: 'nope',
      },
      '26.11.20',
    );
    const [first, second] = rows(ctx);
    expect(first).toMatchObject({
      kind: 'client',
      player: u.id,
      action: 'error',
      message: body.message,
      detail: body.detail,
      page: 'fleet',
      version: '26.11.21',
      browser: 'Firefox',
      request_id: ID,
      count: 1,
      report: '',
    });
    expect(second).toMatchObject({
      action: 'api',
      version: '26.11.20',
      request_id: null,
    });
    expect(second!.message).toHaveLength(ERROR_FIELDS.message);
    expect(second!.detail).toHaveLength(ERROR_FIELDS.detail);
    expect(second!.page).toHaveLength(ERROR_FIELDS.page);
    expect(second!.browser).toHaveLength(ERROR_FIELDS.browser);
    expect(second!.browser).toMatch(/^b \[token\] b/);
  });

  it('refuses an unknown kind', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    expect(() =>
      recordClientError(ctx, u, { ...body, kind: 'server' }, ''),
    ).toThrow(GameError);
    expect(() => recordClientError(ctx, u, {}, '')).toThrow(
      'Unbekannte Fehlerart.',
    );
    expect(rows(ctx)).toEqual([]);
  });

  it('merges equal errors of a player on the same UTC day', () => {
    const ctx = testCtx(10 * DAY + 1000);
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    const start = ctx.now();
    recordClientError(ctx, anna, body, '');
    ctx.clock.t += 5000;
    recordClientError(ctx, anna, { ...body, detail: 'other stack' }, '');
    expect(rows(ctx)).toMatchObject([
      { count: 2, first: start, time: start + 5000, detail: body.detail },
    ]);
    for (const change of [
      { kind: 'rejection' },
      { message: 'other' },
      { page: 'galaxy' },
      { version: '26.11.22' },
    ])
      recordClientError(ctx, anna, { ...body, ...change }, '');
    recordClientError(ctx, bert, body, '');
    expect(rows(ctx).map((r) => r.count)).toEqual([2, 1, 1, 1, 1, 1]);
    ctx.clock.t = 11 * DAY;
    recordClientError(ctx, anna, body, '');
    expect(rows(ctx)).toHaveLength(7);
    recordClientError(ctx, anna, body, '');
    expect(rows(ctx).at(-1)).toMatchObject({ count: 2, first: 11 * DAY });
    expect(rows(ctx)[0]).toMatchObject({ count: 2 });
  });
});

describe('problem reports', () => {
  it('needs a text, cuts it at 1,000 characters and keeps the context', () => {
    expect(() => readReport({ text: '  ' }, '')).toThrow(
      'Bitte beschreibe kurz, was passiert ist.',
    );
    const report = readReport(
      {
        text: `Line 1\nmy mail is anna@example.org ${'x '.repeat(600)}`,
        source: 'toast',
        page: 'fleet',
        version: '',
        requestId: ID,
        message: 'Serverfehler. Vorgang: ' + ID,
        browser: 'Firefox',
      },
      '26.11.21',
    );
    expect(report).toMatchObject({
      action: 'toast',
      page: 'fleet',
      version: '26.11.21',
      requestId: ID,
      message: 'Serverfehler. Vorgang: ' + ID,
      browser: 'Firefox',
      detail: '',
    });
    expect(report.report).toHaveLength(ERROR_FIELDS.report);
    expect(report.report).toMatch(/^Line 1\nmy mail is \[email\] x/);
    expect(readReport({ text: 'x', source: 'other' }, '').action).toBe('form');
  });

  it('stores a report for the player', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    recordReport(ctx, u, readReport({ text: 'Hilfe' }, '26.11.21'));
    expect(rows(ctx)).toMatchObject([
      { kind: 'report', player: u.id, report: 'Hilfe', action: 'form' },
    ]);
  });
});

describe('the admin list', () => {
  function filled() {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    for (let i = 0; i < 12; i++) {
      ctx.clock.t += 1000;
      recordServerError(ctx, { action: `job${i}`, error: new Error('x') });
    }
    recordReport(ctx, u, readReport({ text: 'Hilfe' }, ''));
    recordClientError(ctx, u, { kind: 'error', message: 'm' }, '');
    return ctx;
  }

  it('lists newest first with player names, filtered by kind', () => {
    const ctx = filled();
    const { filter, result } = errorPage(ctx, {});
    expect(filter).toEqual({ kind: '', before: 15 });
    expect(result).toMatchObject({
      page: 1,
      pages: 2,
      count: 14,
      limit: 10,
      before: 15,
    });
    expect(result.errors).toHaveLength(10);
    expect(result.errors[0]).toMatchObject({
      id: 14,
      kind: 'client',
      playerName: 'Anna',
      count: 1,
    });
    expect(result.errors[1]).toMatchObject({
      kind: 'report',
      report: 'Hilfe',
      requestId: null,
    });
    expect(errorPage(ctx, { kind: 'report' }).result).toMatchObject({
      count: 1,
      errors: [{ kind: 'report' }],
    });
    expect(errorPage(ctx, { kind: 'server', limit: 25 }).result).toMatchObject({
      count: 12,
      pages: 1,
      limit: 25,
    });
    expect(errorPage(ctx, { kind: 'nonsense' }).filter.kind).toBe('');
    expect(errorPage(ctx, { kind: 'client' }).result).toMatchObject({
      count: 1,
      errors: [{ kind: 'client' }],
    });
  });

  it('pages a stable snapshot and clamps the page', () => {
    const ctx = filled();
    const { result } = errorPage(ctx, { page: 2 });
    expect(result.errors.map((e) => (e as { id: number }).id)).toEqual([
      4, 3, 2, 1,
    ]);
    recordServerError(ctx, { action: 'new', error: new Error('x') });
    const later = errorPage(ctx, { page: 9, before: result.before });
    expect(later.result).toMatchObject({ page: 2, count: 14, before: 15 });
    expect(errorPage(ctx, {}).result.count).toBe(15);
    expect(errorPage(ctx, { before: 3 }).result.count).toBe(2);
    expect(errorPage(testCtx(), {}).result).toMatchObject({
      count: 0,
      pages: 1,
      before: 1,
      errors: [],
    });
  });
});

describe('retention and account deletion', () => {
  it('keeps the error log 30 days, like the audit log', () => {
    const ctx = testCtx(40 * DAY);
    recordServerError(ctx, { action: 'old', error: 'x' });
    ctx.clock.t += 1;
    recordServerError(ctx, { action: 'kept', error: 'x' });
    ctx.clock.t = 70 * DAY;
    purgeAudit(ctx);
    expect(rows(ctx)).toHaveLength(2);
    ctx.clock.t += 1;
    purgeAudit(ctx);
    expect(rows(ctx).map((r) => r.action)).toEqual(['kept']);
    ctx.clock.t += 1;
    purgeAudit(ctx);
    expect(rows(ctx)).toEqual([]);
  });

  it('a merged error stays while it recurs', () => {
    const ctx = testCtx(40 * DAY);
    const u = addUser(ctx, 'Anna');
    recordClientError(ctx, u, { kind: 'error', message: 'm' }, '');
    ctx.clock.t += DAY / 2;
    recordClientError(ctx, u, { kind: 'error', message: 'm' }, '');
    ctx.clock.t = 70 * DAY + 1;
    purgeAudit(ctx);
    expect(rows(ctx)).toHaveLength(1);
  });

  it('deleting an account removes its errors and reports', () => {
    const ctx = testCtx();
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    recordReport(ctx, anna, readReport({ text: 'a' }, ''));
    recordReport(ctx, bert, readReport({ text: 'b' }, ''));
    recordServerError(ctx, { action: 'x', error: 'y', player: anna.id });
    deleteAccount(ctx, anna, 'secret1');
    expect(rows(ctx)).toMatchObject([{ player: bert.id, report: 'b' }]);
  });
});
