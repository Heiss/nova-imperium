import { describe, expect, it, vi } from 'vitest';
import { asAdmin, start } from '../../test/http.ts';
import { runAction } from '../game/dispatch.ts';
import { addUser, type TestCtx } from '../test-helpers.ts';

// The password check is the cost of every login here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) =>
  (await import('../../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
);

// The admin sees only reported private messages; each opening is an admin
// read in the audit log that names the reports and never a text (#226,
// owner, 2026-11-21, Q24).
const audit = (ctx: TestCtx) =>
  ctx.db
    .prepare(
      "SELECT actor, category, action, target, outcome, detail FROM audit_events WHERE action = 'messageReports' ORDER BY id",
    )
    .all() as {
    actor: string;
    category: string;
    action: string;
    target: string | null;
    outcome: string;
    detail: string;
  }[];

/** Lea writes three messages to Bo; Bo reports the first. Cy has one with Lea, unreported. */
function conversation(ctx: TestCtx): void {
  for (const n of ['Lea', 'Bo', 'Cy']) addUser(ctx, n);
  const say = (from: string, to: string, text: string) => {
    ctx.clock.t += 3000;
    runAction(ctx, `u_${from}`, { type: 'sendPrivateMessage', name: to, text });
  };
  say('Lea', 'Bo', 'GEMELDETER-TEXT');
  say('Lea', 'Bo', 'ANDERER-TEXT');
  say('Bo', 'Lea', 'ANTWORT-TEXT');
  say('Cy', 'Lea', 'GEHEIM-ZWEI');
  runAction(ctx, 'u_Bo', { type: 'reportPrivateMessage', id: 1 });
}

describe('POST /api/admin/message-reports (#226)', () => {
  it('gives the admin the reported message only and records every opening without a text', async () => {
    const { ctx, call } = await asAdmin();
    conversation(ctx);
    const read = await call('POST', '/api/admin/message-reports', {});
    expect(read.status).toBe(200);
    expect(read.json).toEqual({
      reports: [
        {
          id: 1,
          sender: 'Lea',
          recipient: 'Bo',
          reporter: 'Bo',
          sent: expect.any(Number),
          reported: expect.any(Number),
          text: 'GEMELDETER-TEXT',
        },
      ],
    });
    expect(read.text).not.toContain('ANDERER');
    expect(read.text).not.toContain('ANTWORT');
    expect(read.text).not.toContain('GEHEIM-ZWEI');
    await call('POST', '/api/admin/message-reports', {});
    const entries = audit(ctx);
    expect(entries).toEqual([
      {
        actor: 'u_Boss',
        category: 'admin.read',
        action: 'messageReports',
        target: null,
        outcome: 'ok',
        detail: JSON.stringify({ reports: [1] }),
      },
      {
        actor: 'u_Boss',
        category: 'admin.read',
        action: 'messageReports',
        target: null,
        outcome: 'ok',
        detail: JSON.stringify({ reports: [1] }),
      },
    ]);
    const log = JSON.stringify(
      ctx.db.prepare('SELECT * FROM audit_events').all(),
    );
    expect(log).not.toContain('GEMELDETER-TEXT');
    expect(log).not.toContain('TEXT');
  });

  it('shows nothing while nothing is reported, and still records the opening', async () => {
    const { ctx, call } = await asAdmin();
    const read = await call('POST', '/api/admin/message-reports', {});
    expect(read.json).toEqual({ reports: [] });
    expect(audit(ctx).map((r) => r.detail)).toEqual([
      JSON.stringify({ reports: [] }),
    ]);
  });

  it('is only for the admin, and records nothing for a player', async () => {
    const { ctx, call } = await asAdmin();
    conversation(ctx);
    await call('POST', '/api/logout', {});
    await call('POST', '/api/login', { name: 'Bo', password: 'secret1' });
    const refused = await call('POST', '/api/admin/message-reports', {});
    expect(refused.status).toBe(400);
    expect(refused.json).toEqual({ error: 'Nur der Admin darf das.' });
    expect(refused.text).not.toContain('TEXT');
    expect(audit(ctx)).toEqual([]);
  });
});

describe('where the text of a message goes (#226, Q24)', () => {
  const MARKER = 'GEHEIMER-MARKER-4711';

  it('is in the messages and the reports only: in no journal, audit, error log, other table or log line', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (name) => vi.spyOn(console, name).mockImplementation(() => undefined),
    );
    try {
      const logs: string[] = [];
      const { ctx, call } = await start({ logs });
      for (const n of ['Lea', 'Bo']) addUser(ctx, n);
      const action = (body: object) => call('POST', '/api/action', body);
      const login = (name: string) =>
        call('POST', '/api/login', { name, password: 'secret1' });
      expect((await login('lea')).status).toBe(200);
      // A sent message, a refused one (too long), and a body that is no JSON.
      const sent = await action({
        type: 'sendPrivateMessage',
        name: 'Bo',
        text: MARKER,
      });
      expect(sent.status).toBe(200);
      ctx.clock.t += 3000;
      const tooLong = await action({
        type: 'sendPrivateMessage',
        name: 'Bo',
        text: MARKER + 'x'.repeat(1000),
      });
      expect(tooLong.status).toBe(400);
      expect(tooLong.text).not.toContain(MARKER);
      const broken = await call('POST', '/api/action', `{"text": "${MARKER}`);
      expect(broken.status).toBe(400);
      await call('POST', '/api/logout', {});
      // The recipient reads, reports and pages.
      expect((await login('bo')).status).toBe(200);
      for (const body of [
        { type: 'readPrivateMessages', name: 'Lea' },
        { type: 'reportPrivateMessage', id: 1 },
        { type: 'olderPrivateMessages', before: 1 },
      ])
        expect((await action(body)).status, body.type).toBe(200);
      // Meant to be there: the messages and the reports hold the text.
      const holding = (t: string): boolean =>
        JSON.stringify(ctx.db.prepare(`SELECT * FROM ${t}`).all()).includes(
          MARKER,
        );
      expect(holding('private_messages')).toBe(true);
      expect(holding('message_reports')).toBe(true);
      // Meant to be nowhere else: not a row of any other table (the journal
      // `round_events`, `audit_events` and the error log `error_events`
      // among them), not a log line.
      const tables = ctx.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .pluck()
        .all() as string[];
      for (const t of ['round_events', 'audit_events', 'error_events'])
        expect(tables).toContain(t);
      const leaking = tables.filter(
        (t) =>
          t !== 'private_messages' && t !== 'message_reports' && holding(t),
      );
      expect(leaking).toEqual([]);
      expect(logs.join('\n')).not.toContain(MARKER);
      for (const spy of spies)
        expect(JSON.stringify(spy.mock.calls)).not.toContain(MARKER);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
