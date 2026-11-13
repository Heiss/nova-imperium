import Database from 'better-sqlite3';
import { expect, it, vi } from 'vitest';
import {
  activity,
  auditPage,
  audited,
  auditFilter,
  DAY,
  events,
  purgeAudit,
  record,
} from './audit.ts';
import { addUser, testCtx } from './test-helpers.ts';
import { GameError } from './game/context.ts';
import { playerDetail, playerStats } from './game/diagnostics.ts';

it('splits active time at UTC midnight and drops idle intervals and duplicate samples', () => {
  const ctx = testCtx(10 * DAY - 15000);
  const u = addUser(ctx, 'Pilot');
  activity(ctx, u);
  ctx.clock.t += 2000;
  activity(ctx, u);
  ctx.clock.t += 28000;
  activity(ctx, u);
  ctx.clock.t += 300001;
  activity(ctx, u);
  expect(playerDetail(ctx, u.id).days).toMatchObject([
    { day: 10 * DAY, activeMs: 15000 },
    { day: 9 * DAY, activeMs: 15000 },
  ]);
  expect(playerStats(ctx)).toMatchObject([
    { activeMs: 30000, lastSeen: ctx.now() },
  ]);
});

it('rolls back a failing action and keeps the correlated audit entry', () => {
  const ctx = testCtx();
  const u = addUser(ctx, 'Pilot');
  expect(() =>
    audited(
      ctx,
      {
        category: 'admin.write',
        action: 'settings',
        actor: u.id,
        requestId: 'request',
      },
      () => {
        ctx.admin.saveUniverse({ ...ctx.admin.universe(), speed: 99 });
        throw new Error('database fault');
      },
    ),
  ).toThrow('database fault');
  expect(ctx.admin.universe().speed).toBe(5);
  expect(
    events(ctx, auditFilter({ requestId: 'request' }, ctx.now())),
  ).toMatchObject([
    { actor: u.id, outcome: 'error', requestId: 'request', detail: '{}' },
  ]);
});

it('keeps recent records, paginates without overlaps and removes expired data', () => {
  const ctx = testCtx(DAY);
  const u = addUser(ctx, 'Pilot');
  activity(ctx, u);
  record(ctx, { category: 'game', action: 'build', actor: u.id });
  ctx.clock.t += 31 * DAY;
  activity(ctx, u);
  record(ctx, {
    category: 'game',
    action: 'build',
    actor: u.id,
    detail: { planet: 'p1' },
  });
  record(ctx, {
    category: 'game',
    action: 'build',
    actor: u.id,
    detail: { planet: 'p1' },
  });
  expect(
    events(ctx, auditFilter({ reference: 'p1' }, ctx.now())),
  ).toMatchObject([{ id: 3 }, { id: 2 }]);
  expect(
    events(ctx, auditFilter({ reference: 'p1', before: 3 }, ctx.now())),
  ).toMatchObject([{ id: 2 }]);
  expect(events(ctx, auditFilter({ until: ctx.now() - 1 }, ctx.now()))).toEqual(
    [],
  );
  purgeAudit(ctx);
  expect(
    ctx.db.prepare('SELECT id FROM audit_events ORDER BY id').all(),
  ).toEqual([{ id: 2 }, { id: 3 }]);
  expect(ctx.db.prepare('SELECT day FROM player_activity').all()).toEqual([
    { day: 32 * DAY },
  ]);
});

it('pages a stable filtered snapshot, clamps the last page, and accepts only offered limits', () => {
  const ctx = testCtx(DAY);
  for (let i = 0; i < 23; i++)
    record(ctx, { category: 'game', action: 'build' });
  record(ctx, { category: 'game', action: 'research' });
  const first = auditPage(ctx, { action: 'build', limit: 7 }).result;
  expect(first).toMatchObject({ count: 23, limit: 10, page: 1, pages: 3 });
  expect(first.events).toHaveLength(10);
  record(ctx, { category: 'game', action: 'build' });
  const last = auditPage(ctx, {
    action: 'build',
    before: first.before,
    page: 99,
  }).result;
  expect(last).toMatchObject({
    page: 3,
    count: 23,
    events: [{ id: 3 }, { id: 2 }, { id: 1 }],
  });
  expect(auditPage(ctx, { action: 'build', limit: 25 }).result).toMatchObject({
    page: 1,
    pages: 1,
    count: 24,
    limit: 25,
  });
});

const busy = () =>
  new Database.SqliteError('database is locked', 'SQLITE_BUSY');

it('records a rejected action as rejected, a busy database not at all', () => {
  const ctx = testCtx();
  const entry = { category: 'game' as const, action: 'build', requestId: 'r' };
  expect(() =>
    audited(ctx, entry, () => {
      throw new GameError('Nicht genug Rohstoffe.');
    }),
  ).toThrow('Nicht genug Rohstoffe.');
  const error = busy();
  expect(() =>
    audited(ctx, { ...entry, requestId: 'b' }, () => {
      throw error;
    }),
  ).toThrow(error);
  expect(events(ctx, auditFilter({}, ctx.now()))).toMatchObject([
    { requestId: 'r', outcome: 'rejected' },
  ]);
});

it('keeps the original error when the audit write is busy, not when it fails otherwise', () => {
  const ctx = testCtx();
  const prepare = ctx.db.prepare.bind(ctx.db);
  let auditFault: Error = busy();
  vi.spyOn(ctx.db, 'prepare').mockImplementation((sql: string) => {
    if (sql.includes('INSERT INTO audit_events')) throw auditFault;
    return prepare(sql);
  });
  const reject = () => {
    throw new GameError('Ungültig.');
  };
  const entry = { category: 'game' as const, action: 'build' };
  expect(() => audited(ctx, entry, reject)).toThrow(new GameError('Ungültig.'));
  auditFault = new Error('disk full');
  expect(() => audited(ctx, entry, reject)).toThrow('disk full');
});

it('counts activity at the exact limits: 10 s between samples, 5 min idle, midnight', () => {
  const ctx = testCtx(10 * DAY);
  const u = addUser(ctx, 'Pilot');
  const active = () =>
    (
      ctx.db
        .prepare('SELECT SUM(active_ms) AS ms FROM player_activity')
        .get() as { ms: number }
    ).ms;
  activity(ctx, u);
  ctx.clock.t += 9999;
  activity(ctx, u);
  expect(active()).toBe(0);
  ctx.clock.t += 1;
  activity(ctx, u);
  expect(active()).toBe(10000);
  ctx.clock.t += 300000;
  activity(ctx, u);
  expect(active()).toBe(310000);
  ctx.clock.t += 300001;
  activity(ctx, u);
  expect(active()).toBe(310000);

  const v = addUser(ctx, 'Night');
  ctx.clock.t = 11 * DAY - 20000;
  activity(ctx, v);
  ctx.clock.t = 11 * DAY;
  activity(ctx, v);
  expect(playerDetail(ctx, v.id).days).toMatchObject([
    { day: 11 * DAY, activeMs: 0 },
    { day: 10 * DAY, activeMs: 20000 },
  ]);
});

it('keeps audit entries for 30 days', () => {
  const ctx = testCtx(40 * DAY);
  record(ctx, { category: 'game', action: 'old' });
  ctx.clock.t += 30 * DAY;
  record(ctx, { category: 'game', action: 'recent' });
  purgeAudit(ctx);
  expect(
    events(ctx, auditFilter({}, ctx.now())).map(
      (e) => (e as { action: string }).action,
    ),
  ).toEqual(['recent', 'old']);
  ctx.clock.t += 1;
  purgeAudit(ctx);
  expect(ctx.db.prepare('SELECT action FROM audit_events').all()).toEqual([
    { action: 'recent' },
  ]);
  expect(
    events(ctx, auditFilter({}, ctx.now())).map(
      (e) => (e as { action: string }).action,
    ),
  ).toEqual(['recent']);
});

it('leaves the previous day alone when the last sample is exactly midnight (#117)', () => {
  const ctx = testCtx(10 * DAY);
  const u = addUser(ctx, 'Pilot');
  activity(ctx, u);
  ctx.clock.t += 20000;
  const previousDay = vi.spyOn(ctx.admin, 'addActiveTime');
  activity(ctx, u);
  expect(previousDay).not.toHaveBeenCalled();
  expect(playerDetail(ctx, u.id).days).toMatchObject([
    { day: 10 * DAY, activeMs: 20000 },
  ]);
});
