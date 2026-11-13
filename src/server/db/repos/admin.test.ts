import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../../core/universe.ts';
import { addUser, testCtx } from '../../test-helpers.ts';
import type { AuditEvent, AuditFilter } from './admin.ts';

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  time: 10,
  actor: 'u_Anna',
  category: 'game',
  action: 'build',
  outcome: 'ok',
  target: null,
  requestId: 'r1',
  detail: '{}',
  ...over,
});

const all: AuditFilter = {
  player: '',
  action: '',
  requestId: '',
  reference: '',
  outcome: '',
  since: 0,
  until: 1000,
  before: Number.MAX_SAFE_INTEGER,
};

const ids = (rows: unknown[]) => rows.map((r) => (r as { id: number }).id);

describe('admin repository: settings', () => {
  it('keeps the universe settings with defaults', () => {
    const ctx = testCtx();
    expect(ctx.admin.universe()).toEqual(DEFAULT_UNIVERSE);
    ctx.admin.saveUniverse({ ...DEFAULT_UNIVERSE, speed: 9 });
    ctx.admin.saveUniverse({ ...DEFAULT_UNIVERSE, speed: 10, galaxies: 3 });
    expect(ctx.admin.universe()).toEqual({
      ...DEFAULT_UNIVERSE,
      speed: 10,
      galaxies: 3,
    });
  });

  it('reads and writes the round settings beside the universe', () => {
    const ctx = testCtx();
    expect(ctx.admin.roundSettings()).toEqual([]);
    ctx.admin.putSettings([
      ['round', 2],
      ['roundDaily', 0],
      ['other', 5],
    ]);
    ctx.admin.putSettings([['round', 3]]);
    expect(
      ctx.admin.roundSettings().sort((a, b) => a.key.localeCompare(b.key)),
    ).toEqual([
      { key: 'round', value: 3 },
      { key: 'roundDaily', value: 0 },
    ]);
    expect(ctx.admin.universe()).toEqual(DEFAULT_UNIVERSE);
  });
});

describe('admin repository: audit log', () => {
  it('writes events and reads them with the actor name, the newest first', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(ctx.admin.lastAuditId()).toBe(0);
    ctx.admin.addAuditEvent(event({ detail: '{"planet":"p1"}' }));
    ctx.admin.addAuditEvent(
      event({ actor: null, target: 'u_Anna', requestId: null, time: 20 }),
    );
    expect(ctx.admin.lastAuditId()).toBe(2);
    expect(ctx.admin.auditEvents(all, 10, 0)).toEqual([
      {
        id: 2,
        time: 20,
        actor: null,
        actorName: null,
        category: 'game',
        action: 'build',
        outcome: 'ok',
        target: 'u_Anna',
        requestId: null,
        detail: '{}',
      },
      {
        id: 1,
        time: 10,
        actor: 'u_Anna',
        actorName: 'Anna',
        category: 'game',
        action: 'build',
        outcome: 'ok',
        target: null,
        requestId: 'r1',
        detail: '{"planet":"p1"}',
      },
    ]);
    expect(ids(ctx.admin.auditEvents(all, 1, 1))).toEqual([1]);
    expect(ctx.admin.countAuditEvents(all)).toBe(2);
  });

  it('filters the events by every field', () => {
    const ctx = testCtx();
    ctx.admin.addAuditEvent(event({ detail: '{"planet":"p1"}' }));
    ctx.admin.addAuditEvent(
      event({ actor: 'x', target: 'u_Anna', detail: '{"fleet":"f1"}' }),
    );
    ctx.admin.addAuditEvent(
      event({ actor: 'x', action: 'login', requestId: 'r2', time: 30 }),
    );
    ctx.admin.addAuditEvent(
      event({ actor: 'x', outcome: 'error', detail: '{"origin":"o1"}' }),
    );
    const find = (over: Partial<AuditFilter>) =>
      ids(ctx.admin.auditEvents({ ...all, ...over }, 10, 0));
    expect(find({ player: 'u_Anna' })).toEqual([2, 1]);
    expect(find({ action: 'login' })).toEqual([3]);
    expect(find({ requestId: 'r2' })).toEqual([3]);
    expect(find({ reference: 'p1' })).toEqual([1]);
    expect(find({ reference: 'f1' })).toEqual([2]);
    expect(find({ reference: 'o1' })).toEqual([4]);
    expect(find({ outcome: 'error' })).toEqual([4]);
    expect(find({ since: 11, until: 30 })).toEqual([3]);
    expect(find({ until: 29 })).toEqual([4, 2, 1]);
    expect(find({ before: 3 })).toEqual([2, 1]);
    expect(ctx.admin.countAuditEvents({ ...all, player: 'x' })).toBe(3);
  });
});

describe('admin repository: activity and retention', () => {
  it('records the last interaction per day and adds active time', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    expect(ctx.admin.lastActivity('u_Anna')).toBeUndefined();
    ctx.admin.touchActivity('u_Anna', 0, 50, 5);
    ctx.admin.touchActivity('u_Anna', 0, 60, 10);
    ctx.admin.touchActivity('u_Anna', 100, 120, 20);
    ctx.admin.touchActivity('u_Bert', 0, 70, 1);
    expect(ctx.admin.lastActivity('u_Anna')).toEqual({ last: 120 });
    ctx.admin.addActiveTime(7, 'u_Anna', 0);
    expect(
      ctx.db
        .prepare('SELECT * FROM player_activity ORDER BY player, day')
        .all(),
    ).toEqual([
      { player: 'u_Anna', day: 0, last_seen: 60, active_ms: 22 },
      { player: 'u_Anna', day: 100, last_seen: 120, active_ms: 20 },
      { player: 'u_Bert', day: 0, last_seen: 70, active_ms: 1 },
    ]);
  });

  it('purges audit, error and activity rows before the cutoff', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.admin.addAuditEvent(event({ time: 99 }));
    ctx.admin.addAuditEvent(event({ time: 100 }));
    ctx.db.exec(`
      INSERT INTO error_events (kind, time, first, action, page, version,
        browser, message, detail, report)
      VALUES ('server', 99, 1, 'old', '', '', '', '', '', ''),
        ('server', 100, 1, 'new', '', '', '', '', '', '');
    `);
    ctx.admin.touchActivity('u_Anna', 90, 1, 1);
    ctx.admin.touchActivity('u_Anna', 91, 1, 1);
    ctx.admin.purge(100, 10);
    expect(
      ctx.db.prepare('SELECT time FROM audit_events').pluck().all(),
    ).toEqual([100]);
    expect(
      ctx.db.prepare('SELECT action FROM error_events').pluck().all(),
    ).toEqual(['new']);
    expect(
      ctx.db.prepare('SELECT day FROM player_activity').pluck().all(),
    ).toEqual([91]);
  });
});

describe('admin repository: suspensions', () => {
  it('suspends for a time or for good and lifts a suspension', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    expect(ctx.admin.suspension('u_Anna', 0)).toBeUndefined();
    ctx.admin.suspend('u_Anna', 'Spam', 100);
    expect(ctx.admin.suspension('u_Anna', 99)).toEqual({
      reason: 'Spam',
      until: 100,
    });
    expect(ctx.admin.suspension('u_Anna', 100)).toBeUndefined();
    ctx.admin.suspend('u_Anna', 'Again', null);
    ctx.admin.suspend('u_Bert', 'Other', null);
    expect(ctx.admin.suspension('u_Anna', 1e15)).toEqual({
      reason: 'Again',
      until: null,
    });
    ctx.admin.unsuspend('u_Anna');
    expect(ctx.admin.suspension('u_Anna', 0)).toBeUndefined();
    expect(ctx.admin.suspension('u_Bert', 0)?.reason).toBe('Other');
  });
});
