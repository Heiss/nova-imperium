// The rate limit per account for game actions (#328).
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { asAdmin, start } from '../../test/http.ts';
import { GameError } from '../game/context.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import {
  ACTIONS_PER_MINUTE,
  actionLimit,
  type ActionLimit,
} from './action-limit.ts';

const START = 1_000_000;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const TEXT = 'Zu viele Aktionen in kurzer Zeit. Bitte warte einen Moment.';

type Started = Awaited<ReturnType<typeof start>>;

async function twoPlayers(over: Parameters<typeof start>[0] = {}) {
  const s = await start(over);
  for (const name of ['Anna', 'Bert']) {
    addUser(s.ctx, name);
    addPlanet(s.ctx, `u_${name}`);
  }
  return s;
}

async function login(s: Started, name: string): Promise<void> {
  const r = await s.call('POST', '/api/login', { name, password: 'secret1' });
  expect(r.status).toBe(200);
}

const act = (s: Started) => s.call('POST', '/api/action', { type: 'read' });

async function fill(s: Started, n: number): Promise<void> {
  for (let i = 0; i < n; i++) expect((await act(s)).status).toBe(200);
}

const entries = (s: Started, who?: string) =>
  s.ctx.db
    .prepare(
      `SELECT actor, category, action, outcome, request_id AS requestId, detail
       FROM audit_events WHERE action = 'rateLimit' ${who ? `AND actor = '${who}'` : ''}
       ORDER BY id`,
    )
    .all() as Record<string, unknown>[];

describe('the limit of game actions per account (#328)', () => {
  it('takes 120 a minute and refuses the 121st with the text of the other limits', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    expect(ACTIONS_PER_MINUTE).toBe(120);
    await fill(s, 120);
    const refused = await act(s);
    expect(refused).toMatchObject({ status: 400, json: { error: TEXT } });
    // Refused ones count, but the fixed window does not move.
    expect((await act(s)).status).toBe(400);
  });

  it('lets actions pass again when the window is over', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    await fill(s, 120);
    expect((await act(s)).status).toBe(400);
    s.ctx.clock.t += MINUTE - 1;
    expect((await act(s)).status).toBe(400);
    s.ctx.clock.t += 1;
    // A new window: the account has its 120 again.
    expect((await act(s)).status).toBe(200);
  });

  it('counts accounts apart, not the address', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    await fill(s, 120);
    expect((await act(s)).status).toBe(400);
    // Bert, same address, has his own count.
    await login(s, 'Bert');
    await fill(s, 1);
    expect(entries(s).map((e) => e.actor)).toEqual(['u_Anna']);
  });

  it('counts actions and play time reports together, one counter per account (#232)', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    const report = (seq: number) =>
      s.call('POST', '/api/playtime', {
        instance: 'page-0001',
        seq,
        state: 'active',
        since: null,
      });
    for (let i = 0; i < 60; i++) {
      expect((await act(s)).json?.error).not.toBe(TEXT);
      expect((await report(i)).json?.error).not.toBe(TEXT);
    }
    expect(entries(s)).toEqual([]);
    // The 121st call is refused, whichever kind it is, with the same text.
    const refused = await report(60);
    expect(refused).toMatchObject({ status: 400, json: { error: TEXT } });
    expect((await act(s)).json).toEqual({ error: TEXT });
    expect(entries(s)).toHaveLength(1);
    // The reading of the own statistics is no report.
    expect((await s.call('GET', '/api/own-activity')).status).toBe(200);
  });

  it('counts only actions and reports: not GETs, not the activity ping', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    for (let i = 0; i < 130; i++) {
      expect((await s.call('GET', '/api/state')).status).toBe(200);
      expect((await s.call('POST', '/api/activity', {})).status).toBe(200);
    }
    await fill(s, 120);
  });

  it('does not count a request without a session', async () => {
    const s = await twoPlayers();
    for (let i = 0; i < 130; i++) expect((await act(s)).status).toBe(401);
    await login(s, 'Anna');
    await fill(s, 120);
  });

  it('writes the audit entry with the request ID of the first refusal', async () => {
    const s = await twoPlayers();
    await login(s, 'Anna');
    await fill(s, 120);
    expect(entries(s)).toEqual([]);
    const first = await act(s);
    expect(first.status).toBe(400);
    expect(entries(s)).toEqual([
      {
        actor: 'u_Anna',
        category: 'game',
        action: 'rateLimit',
        outcome: 'rejected',
        requestId: first.headers.get('x-request-id'),
        detail: '{"limit":120,"windowSeconds":60}',
      },
    ]);
  });

  it('limits an admin like everyone', async () => {
    const s = await asAdmin();
    await fill(s, 120);
    expect((await act(s)).json).toEqual({ error: TEXT });
    expect(entries(s, 'u_Boss')).toHaveLength(1);
  });

  it('shows the entry in the audit view of the admin', async () => {
    const s = await asAdmin();
    addUser(s.ctx, 'Anna');
    addPlanet(s.ctx, 'u_Anna');
    const admin = s.ctx.players.byName('Boss')!;
    expect(admin.admin).toBe(true);
    await fill(s, 120);
    await act(s);
    const audit = await s.call('POST', '/api/admin/events', {
      outcome: 'rejected',
      action: 'rateLimit',
    });
    expect(audit.status).toBe(200);
    expect(audit.json).toMatchObject({
      events: [
        {
          actor: 'u_Boss',
          actorName: 'Boss',
          category: 'game',
          action: 'rateLimit',
          outcome: 'rejected',
        },
      ],
    });
  });
});

// The windows of the audit entry without the HTTP round trips.
describe('the audit entry of the limit (#328)', () => {
  function setup() {
    const ctx = testCtx(START);
    for (const name of ['Anna', 'Bert']) addUser(ctx, name);
    const make = () => actionLimit(ctx);
    const hits = (limit: ActionLimit, name: string, n: number): boolean => {
      let refused = false;
      for (let i = 0; i < n; i++) {
        try {
          limit.check(ctx.players.byName(name)!, `req${i}`);
        } catch (error) {
          expect(error).toBeInstanceOf(GameError);
          refused = true;
        }
      }
      return refused;
    };
    const written = (who = 'u_Anna'): number =>
      ctx.db
        .prepare(
          "SELECT COUNT(*) FROM audit_events WHERE action = 'rateLimit' AND actor = ?",
        )
        .pluck()
        .get(who) as number;
    return { ctx, make, hits, written };
  }

  it('is written once on the first refusal, not again within the hour, again after it', () => {
    const { ctx, make, hits, written } = setup();
    const limit = make();
    expect(hits(limit, 'Anna', 120)).toBe(false);
    expect(written()).toBe(0);
    expect(hits(limit, 'Anna', 1)).toBe(true);
    expect(written()).toBe(1);
    expect(hits(limit, 'Anna', 5)).toBe(true);
    for (const at of [MINUTE, 30 * MINUTE, HOUR - 1]) {
      ctx.clock.t = START + at;
      expect(hits(limit, 'Anna', 121)).toBe(true);
      expect(written()).toBe(1);
    }
    ctx.clock.t = START + HOUR;
    expect(hits(limit, 'Anna', 121)).toBe(true);
    expect(written()).toBe(2);
    expect(hits(limit, 'Anna', 5)).toBe(true);
    expect(written()).toBe(2);
  });

  it('counts a fixed window: 120 pass, the next minute starts at the end of the window', () => {
    const { ctx, make, hits } = setup();
    const limit = make();
    expect(hits(limit, 'Anna', 120)).toBe(false);
    expect(hits(limit, 'Anna', 1)).toBe(true);
    ctx.clock.t = START + MINUTE - 1;
    expect(hits(limit, 'Anna', 1)).toBe(true);
    ctx.clock.t = START + MINUTE;
    expect(hits(limit, 'Anna', 120)).toBe(false);
    expect(hits(limit, 'Bert', 120)).toBe(false);
    expect(hits(limit, 'Anna', 1)).toBe(true);
  });

  it('leaves an honest session far below the limit', () => {
    const { ctx, make, hits } = setup();
    const limit = make();
    // Ten minutes: a heartbeat every 30 s (2 a minute), one action every
    // two seconds (30 a minute) and a second open page (2 more heartbeats).
    const perMinute = 2 + 30 + 2;
    expect(perMinute * 3).toBeLessThan(ACTIONS_PER_MINUTE);
    for (let minute = 0; minute < 10; minute++) {
      ctx.clock.t = START + minute * MINUTE;
      expect(hits(limit, 'Anna', perMinute)).toBe(false);
    }
  });

  it('is written per account', () => {
    const { make, hits, written } = setup();
    const limit = make();
    expect(hits(limit, 'Anna', 121)).toBe(true);
    expect(written('u_Bert')).toBe(0);
    expect(hits(limit, 'Bert', 121)).toBe(true);
    expect([written('u_Anna'), written('u_Bert')]).toEqual([1, 1]);
  });

  it('keeps its hour across a restart: a new limiter asks the audit log', () => {
    const { ctx, make, hits, written } = setup();
    expect(hits(make(), 'Anna', 121)).toBe(true);
    ctx.clock.t = START + MINUTE;
    const restarted = make();
    expect(hits(restarted, 'Anna', 121)).toBe(true);
    expect(written()).toBe(1);
    ctx.clock.t = START + HOUR;
    expect(hits(restarted, 'Anna', 121)).toBe(true);
    expect(written()).toBe(2);
  });

  it('forgets the windows and notes of a sweep after their time', () => {
    const { ctx, make, hits, written } = setup();
    const limit = make();
    expect(hits(limit, 'Anna', 121)).toBe(true);
    ctx.clock.t = START + MINUTE;
    limit.sweep();
    // The window is gone, the note is kept for the hour.
    expect(hits(limit, 'Anna', 120)).toBe(false);
    expect(hits(limit, 'Anna', 1)).toBe(true);
    expect(written()).toBe(1);
    ctx.clock.t = START + HOUR;
    limit.sweep();
    expect(hits(limit, 'Anna', 121)).toBe(true);
    expect(written()).toBe(2);
  });

  it('is skipped, not fatal, when the audit log is busy', () => {
    const { ctx, make, hits, written } = setup();
    const limit = make();
    const busy = new Database.SqliteError('database is locked', 'SQLITE_BUSY');
    const add = ctx.admin.addAuditEvent.bind(ctx.admin);
    ctx.admin.addAuditEvent = () => {
      throw busy;
    };
    expect(hits(limit, 'Anna', 121)).toBe(true);
    expect(written()).toBe(0);
    ctx.admin.addAuditEvent = add;
    expect(hits(limit, 'Anna', 1)).toBe(true);
    expect(written()).toBe(1);
  });
});
