import { describe, expect, it, vi } from 'vitest';
import { asAdmin, start } from '../../test/http.ts';
import { record } from '../audit.ts';
import { deleteAccount } from '../delete-account.ts';
import { botCheckOf } from '../game/bot-check.ts';
import { runAction } from '../game/dispatch.ts';
import { stateFor } from '../game/state.ts';
import { addPlanet, addUser, type TestCtx } from '../test-helpers.ts';

// The password check is the cost of every login here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) =>
  (await import('../../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
);

// „Automatisierung prüfen“ (#181; owner, 2026-11-14 and 2026-11-21): the
// admin switches the check on for one player; the record shows raw facts
// from the moment of switching on, at most 30 days back; the switch is an
// admin write, the record an admin read; the player can tell nothing.

const DAY = 86400000;

/** A game action of the audit log, as the action route writes it. */
const played = (ctx: TestCtx, uid: string, action = 'build') =>
  record(ctx, { category: 'game', action, actor: uid });

const botAudit = (ctx: TestCtx) =>
  ctx.db
    .prepare(
      "SELECT time, actor, category, action, target, outcome, detail FROM audit_events WHERE action = 'botCheck' ORDER BY id",
    )
    .all();

async function world() {
  const s = await asAdmin();
  addUser(s.ctx, 'Lea');
  addPlanet(s.ctx, 'u_Lea');
  return s;
}

const recordOf = async (s: Awaited<ReturnType<typeof world>>) =>
  (await s.call('POST', '/api/admin/player', { player: 'u_Lea' })).json as {
    botCheck: { since: number | null; days: { actions: number }[] };
  };

describe('POST /api/admin/bot-check (#181)', () => {
  it('is off by default and shows nothing, even with actions in the log', async () => {
    const s = await world();
    played(s.ctx, 'u_Lea');
    expect((await recordOf(s)).botCheck).toEqual({ since: null, days: [] });
  });

  it('switches on with an audit entry, and the record shows only what came after', async () => {
    const s = await world();
    played(s.ctx, 'u_Lea');
    s.ctx.clock.t += 1000;
    const on = s.ctx.clock.t;
    const switched = await s.call('POST', '/api/admin/bot-check', {
      player: 'u_Lea',
      on: true,
    });
    expect(switched.status).toBe(200);
    expect(switched.json).toEqual({ botCheck: { since: on, days: [] } });
    expect(botAudit(s.ctx)).toEqual([
      {
        time: on,
        actor: 'u_Boss',
        category: 'admin.write',
        action: 'botCheck',
        target: 'u_Lea',
        outcome: 'ok',
        detail: JSON.stringify({ on: true }),
      },
    ]);
    s.ctx.clock.t += 2000;
    played(s.ctx, 'u_Lea');
    s.ctx.clock.t += 3000;
    played(s.ctx, 'u_Lea');
    played(s.ctx, 'u_Lea', 'rateLimit');
    const { botCheck } = await recordOf(s);
    expect(botCheck.since).toBe(on);
    expect(botCheck.days).toEqual([
      {
        day: on - (on % DAY),
        actions: 2,
        outsidePlay: 2,
        limitHits: 1,
        gaps: { shortest: 3, lower: 3, median: 3, upper: 3 },
      },
    ]);
    // Reading the record is an admin read, as before.
    const reads = s.ctx.db
      .prepare(
        "SELECT actor, category, target FROM audit_events WHERE action = 'player'",
      )
      .all();
    expect(reads).toContainEqual({
      actor: 'u_Boss',
      category: 'admin.read',
      target: 'u_Lea',
    });
  });

  it('switches off, and on again starts a new period (Q39)', async () => {
    const s = await world();
    await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: true });
    played(s.ctx, 'u_Lea');
    s.ctx.clock.t += 1000;
    const off = await s.call('POST', '/api/admin/bot-check', {
      player: 'u_Lea',
      on: false,
    });
    expect(off.json).toEqual({ botCheck: { since: null, days: [] } });
    expect(s.ctx.db.prepare('SELECT * FROM bot_checks').all()).toEqual([]);
    s.ctx.clock.t += 1000;
    await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: true });
    expect((await recordOf(s)).botCheck.days).toEqual([]);
    expect(
      botAudit(s.ctx).map((r) => (r as { detail: string }).detail),
    ).toEqual([
      JSON.stringify({ on: true }),
      JSON.stringify({ on: false }),
      JSON.stringify({ on: true }),
    ]);
  });

  it('shows no day older than 30 days, though the log and the play time still hold it', async () => {
    const s = await world();
    await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: true });
    played(s.ctx, 'u_Lea');
    s.ctx.playtime.append({
      user: 'u_Lea',
      round: 1,
      session: 1,
      instance: 'i',
      seq: 1,
      state: 'active',
      reason: 'heartbeat',
      method: 1,
      start: s.ctx.clock.t - 1000,
      end: s.ctx.clock.t + 1000,
    });
    s.ctx.clock.t += 31 * DAY;
    played(s.ctx, 'u_Lea');
    // Nothing pruned the log here: the cut is the one of the hints.
    expect(
      s.ctx.db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'build'",
        )
        .get(),
    ).toEqual({ n: 2 });
    // (The session of the admin has ended after 31 days: the record as the
    // route builds it.)
    const { days } = botCheckOf(s.ctx, 'u_Lea');
    expect(days).toHaveLength(1);
    expect(days[0]!.actions).toBe(1);
    expect(days[0]!.outsidePlay).toBe(1);
  });

  it('refuses a player who is not there, a missing on or off and a non-admin', async () => {
    const s = await world();
    expect(
      (
        await s.call('POST', '/api/admin/bot-check', {
          player: 'u_X',
          on: true,
        })
      ).json,
    ).toEqual({ error: 'Spieler nicht gefunden.' });
    expect(
      (await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: 1 }))
        .json,
    ).toEqual({ error: 'Bitte an oder aus wählen.' });
    expect(s.ctx.db.prepare('SELECT * FROM bot_checks').all()).toEqual([]);
    const p = await start();
    addUser(p.ctx, 'Lea');
    addPlanet(p.ctx, 'u_Lea');
    await p.call('POST', '/api/login', { name: 'lea', password: 'secret1' });
    const refused = await p.call('POST', '/api/admin/bot-check', {
      player: 'u_Lea',
      on: true,
    });
    expect(refused.status).toBe(400);
    expect(refused.json).toEqual({ error: expect.any(String) });
    expect(p.ctx.db.prepare('SELECT * FROM bot_checks').all()).toEqual([]);
  });
});

describe('the player cannot tell the check (#181, D5)', () => {
  it('gets the same state and the same answers with the check on and off', async () => {
    const s = await world();
    const seen = () => {
      let answer: unknown;
      try {
        answer = runAction(s.ctx, 'u_Lea', { type: 'rename', name: 'Heim' });
      } catch (error) {
        answer = (error as Error).message;
      }
      const lea = s.ctx.players.get('u_Lea')!;
      return JSON.stringify({ answer, state: stateFor(s.ctx, lea) });
    };
    const off = seen();
    await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: true });
    expect(seen()).toBe(off);
    expect(seen()).not.toContain('botCheck');
  });

  it('goes with the account, with the audit rows the hints read', async () => {
    const s = await world();
    await s.call('POST', '/api/admin/bot-check', { player: 'u_Lea', on: true });
    played(s.ctx, 'u_Lea');
    deleteAccount(s.ctx, s.ctx.players.get('u_Lea')!, 'secret1');
    expect(s.ctx.db.prepare('SELECT * FROM bot_checks').all()).toEqual([]);
    expect(
      s.ctx.db
        .prepare(
          "SELECT COUNT(*) AS n FROM audit_events WHERE actor = 'u_Lea' OR target = 'u_Lea'",
        )
        .get(),
    ).toEqual({ n: 0 });
  });
});
