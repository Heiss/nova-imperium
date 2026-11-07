import { expect, it } from 'vitest';
import {
  activity,
  audited,
  auditFilter,
  DAY,
  events,
  purgeAudit,
  record,
} from './audit.ts';
import { addUser, testCtx } from './test-helpers.ts';
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
        ctx.store.saveUniverse({ ...ctx.store.universe(), speed: 99 });
        throw new Error('database fault');
      },
    ),
  ).toThrow('database fault');
  expect(ctx.store.universe().speed).toBe(5);
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
    ctx.store.db.prepare('SELECT id FROM audit_events ORDER BY id').all(),
  ).toEqual([{ id: 2 }, { id: 3 }]);
  expect(ctx.store.db.prepare('SELECT day FROM player_activity').all()).toEqual(
    [{ day: 32 * DAY }],
  );
});
