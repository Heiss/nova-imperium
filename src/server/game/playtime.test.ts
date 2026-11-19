// The estimated active play time on the server (#232, #231): the reports of
// the browser, the intervals they become and the sums derived from them.
import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../../core/activity.ts';
import { METHOD_VERSION, type Report } from '../../core/playtime.ts';
import { record } from '../audit.ts';
import { addUser, testCtx, type TestCtx } from '../test-helpers.ts';
import { GameError } from './context.ts';
import { playerDetail, playerStats } from './diagnostics.ts';
import { ownActivity, recordPlaytime } from './playtime.ts';

const START = 10 * DAY_MS + 12 * 3600_000;
const PAGE = 'page-0001';

const send = (
  ctx: TestCtx,
  who: ReturnType<typeof addUser>,
  r: Partial<Report> & Pick<Report, 'seq'>,
  instance = PAGE,
): void =>
  recordPlaytime(ctx, who, {
    instance,
    state: 'active',
    since: null,
    ...r,
  });

const rows = (ctx: TestCtx) =>
  ctx.db
    .prepare(
      `SELECT user_id AS user, round, play_session AS session, instance, seq,
         state, reason, start_ms AS start, end_ms AS end, method
       FROM playtime_events ORDER BY id`,
    )
    .all();

/** A page that was active for `seconds` with a report every 30 s, then went idle. */
function activeFor(
  ctx: TestCtx,
  who: ReturnType<typeof addUser>,
  seconds: number,
  instance = PAGE,
  from = 0,
): number {
  let seq = from;
  send(ctx, who, { seq: seq++, since: null }, instance);
  for (let t = 0; t < seconds; t += 30) {
    const step = Math.min(30, seconds - t);
    ctx.clock.t += step * 1000;
    send(
      ctx,
      who,
      {
        seq: seq++,
        since: step * 1000,
        state: t + step >= seconds ? 'inactive' : 'active',
      },
      instance,
    );
  }
  return seq;
}

describe('recordPlaytime', () => {
  it('stores the accepted intervals as events with round, session and method', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    ctx.admin.putSettings([['round', 4]]);
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 1, since: 30_000 });
    ctx.clock.t += 12_000;
    send(ctx, u, { seq: 2, since: 12_000, state: 'inactive' });
    expect(rows(ctx)).toEqual([
      {
        user: u.id,
        round: 4,
        session: 1,
        instance: PAGE,
        seq: 0,
        state: 'active',
        reason: 'start',
        start: START,
        end: START,
        method: METHOD_VERSION,
      },
      expect.objectContaining({
        seq: 1,
        reason: 'heartbeat',
        start: START,
        end: START + 30_000,
      }),
      expect.objectContaining({
        seq: 2,
        state: 'inactive',
        reason: 'idle',
        start: START + 30_000,
        end: START + 42_000,
      }),
    ]);
    expect(ownActivity(ctx, u).roundMs).toBe(42_000);
  });

  it('refuses what is no report and stores nothing', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    expect(() => recordPlaytime(ctx, u, {})).toThrow(GameError);
    expect(() =>
      recordPlaytime(ctx, u, {
        instance: PAGE,
        seq: 0,
        state: 'active',
        since: -1,
      }),
    ).toThrow('Ungültige Meldung.');
    expect(rows(ctx)).toEqual([]);
  });

  it('counts a replayed or out-of-order report once', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 1, since: 30_000 });
    ctx.clock.t += 1000;
    send(ctx, u, { seq: 1, since: 30_000 });
    send(ctx, u, { seq: 0 });
    expect(rows(ctx)).toHaveLength(2);
    expect(ownActivity(ctx, u).roundMs).toBe(30_000);
  });

  it('keeps the idle time of a long absence out, however it is reported', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 1, since: 30_000 });
    // The stop never arrives, the page is gone for an hour and then reports a heartbeat.
    ctx.clock.t += 3600_000;
    send(ctx, u, { seq: 2, since: 30_000 });
    expect(ownActivity(ctx, u).roundMs).toBe(30_000);
    // The next heartbeat then counts again from the new start.
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 3, since: 30_000 });
    expect(ownActivity(ctx, u).roundMs).toBe(60_000);
  });

  it('does not credit a claim above the heartbeat or above the time the server has seen', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 5000;
    send(ctx, u, { seq: 1, since: 3_000_000 });
    ctx.clock.t += 50_000;
    send(ctx, u, { seq: 2, since: 3_000_000 });
    expect(ownActivity(ctx, u).roundMs).toBe(5000 + 30_000);
  });

  it('counts two pages of one player that overlap in time once', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 }, 'page-aaaa');
    send(ctx, u, { seq: 0 }, 'page-bbbb');
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 1, since: 30_000 }, 'page-aaaa');
    send(ctx, u, { seq: 1, since: 30_000 }, 'page-bbbb');
    ctx.clock.t += 10_000;
    send(ctx, u, { seq: 2, since: 10_000 }, 'page-bbbb');
    expect(rows(ctx)).toHaveLength(5);
    expect(ownActivity(ctx, u).roundMs).toBe(40_000);
  });

  it('records nothing in vacation mode', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    send(ctx, { ...u, vacation: START }, { seq: 0 });
    expect(rows(ctx)).toEqual([]);
  });

  it('takes the state from the database, so a restart does not open or double an interval', () => {
    const first = testCtx(START);
    const u = addUser(first, 'Anna');
    send(first, u, { seq: 0 });
    first.clock.t += 30_000;
    send(first, u, { seq: 1, since: 30_000 });
    // The server restarts: a new context over the same database.
    const second = testCtx(START + 40_000, 1, first.db);
    send(second, u, { seq: 1, since: 30_000 });
    send(second, u, { seq: 2, since: 10_000 });
    expect(ownActivity(second, u).roundMs).toBe(40_000);
    // And a server that stays away: nothing is counted for the time it was down.
    const third = testCtx(START + 40_000 + 3600_000, 1, first.db);
    send(third, u, { seq: 3, since: 30_000 });
    expect(ownActivity(third, u).roundMs).toBe(40_000);
  });

  it('numbers the usage sessions: a pause of 30 minutes or a new round starts one', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    const other = addUser(ctx, 'Bert');
    let seq = activeFor(ctx, u, 60);
    ctx.clock.t += 29 * 60_000;
    seq = activeFor(ctx, u, 30, PAGE, seq);
    ctx.clock.t += 30 * 60_000;
    seq = activeFor(ctx, u, 30, PAGE, seq);
    ctx.admin.putSettings([['round', 2]]);
    ctx.clock.t += 5000;
    activeFor(ctx, u, 30, PAGE, seq);
    activeFor(ctx, other, 30, 'page-cccc');
    const sessions = (id: string) =>
      new Set(
        (rows(ctx) as { user: string; session: number }[])
          .filter((r) => r.user === id)
          .map((r) => r.session),
      );
    expect([...sessions(u.id)]).toEqual([1, 2, 3]);
    expect([...sessions(other.id)]).toEqual([1]);
  });
});

describe('the own statistics', () => {
  it('splits the time at UTC midnight and keeps the days apart', () => {
    const ctx = testCtx(10 * DAY_MS - 15_000);
    const u = addUser(ctx, 'Anna');
    send(ctx, u, { seq: 0 });
    ctx.clock.t += 30_000;
    send(ctx, u, { seq: 1, since: 30_000, state: 'inactive' });
    const own = ownActivity(ctx, u);
    expect(own.days).toHaveLength(7);
    expect(own.days.slice(0, 2)).toEqual([
      { day: 10 * DAY_MS, activeMs: 15_000, actions: 0 },
      { day: 9 * DAY_MS, activeMs: 15_000, actions: 0 },
    ]);
    expect(own.days.map((d) => d.day)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((i) => (10 - i) * DAY_MS),
    );
  });

  it('counts the successful actions per day from the audit log', () => {
    const ctx = testCtx(10 * DAY_MS + 1000);
    const u = addUser(ctx, 'Anna');
    record(ctx, { category: 'game', action: 'build', actor: u.id });
    record(ctx, { category: 'game', action: 'build', actor: u.id });
    ctx.db
      .prepare('UPDATE audit_events SET time = ? WHERE id = 1')
      .run(9 * DAY_MS + 5);
    ctx.admin.addAuditEvent({
      time: ctx.now(),
      actor: u.id,
      category: 'game',
      action: 'build',
      outcome: 'rejected',
      target: null,
      requestId: null,
      detail: '{}',
    });
    expect(ownActivity(ctx, u).days.slice(0, 2)).toMatchObject([
      { actions: 1 },
      { actions: 1 },
    ]);
  });

  it('shows the capture start, the last activity, the round and the whole account', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    expect(ownActivity(ctx, u)).toMatchObject({
      since: null,
      last: null,
      roundMs: 0,
      totalMs: 0,
      method: METHOD_VERSION,
      now: START,
      round: 1,
    });
    let seq = activeFor(ctx, u, 60);
    const endOfFirst = ctx.now();
    // The next round: the account total keeps growing, the round total starts anew.
    ctx.admin.putSettings([['round', 2]]);
    ctx.clock.t += 40 * 60_000;
    seq = activeFor(ctx, u, 30, PAGE, seq);
    expect(seq).toBeGreaterThan(0);
    expect(ownActivity(ctx, u)).toMatchObject({
      since: START,
      last: ctx.now(),
      round: 2,
      roundMs: 30_000,
      totalMs: 90_000,
    });
    expect(endOfFirst).toBe(START + 60_000);
  });

  it('shows a player only their own time', () => {
    const ctx = testCtx(START);
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Bert');
    activeFor(ctx, a, 90);
    expect(ownActivity(ctx, a).roundMs).toBe(90_000);
    expect(ownActivity(ctx, b)).toMatchObject({
      roundMs: 0,
      totalMs: 0,
      since: null,
      last: null,
    });
  });

  it('is derived from the events alone: nothing else is stored', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    activeFor(ctx, u, 60);
    const before = ownActivity(ctx, u);
    // A fresh context over the same database gives the same answer.
    const again = testCtx(START + 60_000, 9, ctx.db);
    expect(ownActivity(again, u)).toEqual(before);
    expect(
      ctx.db.prepare('SELECT COUNT(*) AS n FROM player_activity').get(),
    ).toEqual({
      n: 0,
    });
  });

  it('is not removed by the 30-day purge of the audit log', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    activeFor(ctx, u, 60);
    ctx.clock.t += 40 * DAY_MS;
    ctx.admin.purge(ctx.now() - 30 * DAY_MS, DAY_MS);
    expect(ownActivity(ctx, u)).toMatchObject({
      totalMs: 60_000,
      since: START,
    });
  });

  it('goes with the account', () => {
    const ctx = testCtx(START);
    const u = addUser(ctx, 'Anna');
    activeFor(ctx, u, 60);
    ctx.db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    expect(rows(ctx)).toEqual([]);
  });
});

describe('the admin sums', () => {
  it('agree with the players own view', () => {
    const ctx = testCtx(START);
    const a = addUser(ctx, 'Anna');
    const b = addUser(ctx, 'Bert');
    activeFor(ctx, a, 90);
    activeFor(ctx, a, 30, 'page-bbbb');
    activeFor(ctx, b, 30, 'page-cccc');
    const stats = playerStats(ctx) as {
      id: string;
      activeMs: number;
      lastSeen: number | null;
    }[];
    const week = (u: typeof a) =>
      ownActivity(ctx, u).days.reduce((sum, d) => sum + d.activeMs, 0);
    expect(stats.find((s) => s.id === a.id)!.activeMs).toBe(week(a));
    expect(stats.find((s) => s.id === b.id)!.activeMs).toBe(week(b));
    expect(stats.find((s) => s.id === a.id)!.lastSeen).toBe(
      ownActivity(ctx, a).last,
    );
    const days = playerDetail(ctx, a.id).days;
    expect(days).toEqual([{ day: 10 * DAY_MS, activeMs: week(a), actions: 0 }]);
  });

  it('shows a player without any time as zero, with the old last sighting', () => {
    const ctx = testCtx(START);
    const a = addUser(ctx, 'Anna');
    ctx.db
      .prepare('INSERT INTO player_activity VALUES (?, ?, ?, ?)')
      .run(a.id, 9 * DAY_MS, 9 * DAY_MS + 77, 1_000_000);
    expect(playerStats(ctx)).toMatchObject([
      { activeMs: 0, lastSeen: 9 * DAY_MS + 77 },
    ]);
    expect(playerDetail(ctx, a.id).days).toEqual([]);
  });
});
