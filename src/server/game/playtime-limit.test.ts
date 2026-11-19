// The limit of rows per page of the play time (#232, owner, 2026-11-19): on
// the server, where the state of a page is read from the stored rows. The rule
// itself is `judge` in src/core/playtime.ts and has its own tests there.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/activity.ts';
import type { Report } from '../../core/playtime.ts';
import { addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { ownActivity, recordPlaytime } from './playtime.ts';

const START = 10 * DAY_MS + 12 * 3600_000;
const PAGE = 'page-0001';

const send = (
  ctx: TestCtx,
  who: ReturnType<typeof addUser>,
  r: Partial<Report> & Pick<Report, 'seq'>,
  instance = PAGE,
): void =>
  recordPlaytime(ctx, who, { instance, state: 'active', since: null, ...r });

const reasons = (ctx: TestCtx, instance = PAGE): string[] =>
  (
    ctx.db
      .prepare(
        'SELECT reason FROM playtime_events WHERE instance = ? ORDER BY seq',
      )
      .all(instance) as { reason: string }[]
  ).map((r) => r.reason);

const count = (ctx: TestCtx): number =>
  ctx.db
    .prepare('SELECT COUNT(*) FROM playtime_events')
    .pluck()
    .get() as number;

describe('the limit of rows per page', () => {
  it('stores an honest session as before: a start, a heartbeat every 30 s, the stop at the timeout', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    for (let k = 1; k <= 3; k++) {
      ctx.clock.t += 30_000;
      send(ctx, u, { seq: k, since: 30_000 });
    }
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 4, since: 30_000, state: 'inactive' });
    expect(reasons(ctx)).toEqual([
      'start',
      'heartbeat',
      'heartbeat',
      'heartbeat',
      'idle',
    ]);
    expect(ownActivity(ctx, u).totalMs).toBe(120_000);
  });

  it('stores a start and a stop 3 s later as before', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 3000;
    send(ctx, u, { seq: 1, since: 3000, state: 'background' });
    expect(reasons(ctx)).toEqual(['start', 'background']);
    expect(ownActivity(ctx, u).totalMs).toBe(3000);
  });

  it('keeps every heartbeat of an interval that runs for two hours, one per 30 s', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    for (let k = 1; k <= 240; k++) {
      ctx.clock.t += 30_000;
      send(ctx, u, { seq: k, since: 30_000 });
    }
    expect(count(ctx)).toBe(241);
    expect(ownActivity(ctx, u).totalMs).toBe(240 * 30_000);
  });

  it('stores a flood of 100 reports in one second from one page as a start and one heartbeat', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    for (let k = 1; k <= 100; k++) {
      ctx.clock.t += 10;
      send(ctx, u, { seq: k, since: 30_000 });
    }
    expect(reasons(ctx)).toEqual(['start', 'heartbeat']);
    // The credit is the time that passed, not what the reports claim.
    expect(ownActivity(ctx, u).totalMs).toBeLessThanOrEqual(1000);
    // The next heartbeat of the page a heartbeat interval later is stored again.
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 101, since: 30_000 });
    expect(reasons(ctx)).toEqual(['start', 'heartbeat', 'heartbeat']);
  });

  it('stores a flood of starts as one row', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    for (let k = 0; k < 100; k++) {
      ctx.clock.t += 5;
      send(ctx, u, { seq: k });
    }
    expect(reasons(ctx)).toEqual(['start']);
  });

  it('limits every page of a player on its own, and nothing bounds the number of pages', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    const pages = Array.from({ length: 6 }, (_, k) => `page-flood${k}`);
    for (const page of pages) {
      send(ctx, u, { seq: 0 }, page);
      for (let k = 1; k <= 20; k++) {
        ctx.clock.t += 10;
        send(ctx, u, { seq: k, since: 30_000 }, page);
      }
    }
    for (const page of pages)
      expect(reasons(ctx, page), page).toEqual(['start', 'heartbeat']);
    // A page the player makes up for every report is a page of its own: that is the open part.
    for (let k = 0; k < 10; k++) send(ctx, u, { seq: 0 }, `page-made-up${k}`);
    expect(count(ctx)).toBe(6 * 2 + 10);
  });

  it('reads the count of the interval from the stored rows, so a restart of the server changes nothing', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 5000;
    send(ctx, u, { seq: 1, since: 5000 });
    // A heartbeat 5 s later is dropped, one 30 s after the start is not.
    ctx.clock.t += 5000;
    send(ctx, u, { seq: 2, since: 5000 });
    expect(reasons(ctx)).toEqual(['start', 'heartbeat']);
    ctx.clock.t += 20_000;
    send(ctx, u, { seq: 3, since: 25_000 });
    expect(reasons(ctx)).toEqual(['start', 'heartbeat', 'heartbeat']);
  });

  it('opens a new count with each interval: a start after a stop earns its heartbeats again', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 40_000;
    send(ctx, u, { seq: 1, since: 30_000 });
    send(ctx, u, { seq: 2, since: 10_000, state: 'inactive' });
    ctx.clock.t += 5000;
    send(ctx, u, { seq: 3 });
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 4, since: 30_000 });
    expect(reasons(ctx)).toEqual([
      'start',
      'heartbeat',
      'idle',
      'start',
      'heartbeat',
    ]);
  });
});
