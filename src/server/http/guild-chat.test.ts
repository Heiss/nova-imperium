import { describe, expect, it, vi } from 'vitest';
import { asAdmin } from '../../test/http.ts';
import { runAction } from '../game/dispatch.ts';
import { addPlanet, addUser, type TestCtx } from '../test-helpers.ts';

// The password check is the cost of every login here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) =>
  (await import('../../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
);

// The admin reads every guild chat; each opening is an admin read in the
// audit log (#169, owner, 2026-11-14, D8).
const audit = (ctx: TestCtx) =>
  ctx.db
    .prepare(
      "SELECT actor, category, action, target, outcome, detail FROM audit_events WHERE action = 'guildChat' ORDER BY id",
    )
    .all() as {
    actor: string;
    category: string;
    action: string;
    target: string | null;
    outcome: string;
    detail: string;
  }[];

function guild(ctx: TestCtx): string {
  addUser(ctx, 'Lea');
  addPlanet(ctx, 'u_Lea', { p: 7 });
  runAction(ctx, 'u_Lea', {
    type: 'createGuild',
    tag: 'OR',
    name: 'Outer Rim',
  });
  runAction(ctx, 'u_Lea', {
    type: 'sendGuildChat',
    text: '<script>alert(1)</script>',
  });
  return ctx.guilds.membership('u_Lea')!.guild_id;
}

describe('POST /api/admin/guild-chat (#169)', () => {
  it('gives the admin the chat of any guild and records every reading', async () => {
    const { ctx, call } = await asAdmin();
    const id = guild(ctx);
    const read = await call('POST', '/api/admin/guild-chat', { guild: id });
    expect(read.status).toBe(200);
    expect(read.json).toEqual({
      guild: { id, tag: 'OR', name: 'Outer Rim' },
      messages: [
        {
          id: 1,
          time: expect.any(Number),
          kind: 'message',
          name: 'Lea',
          text: '<script>alert(1)</script>',
        },
      ],
    });
    // JSON, not HTML: the view escapes the text.
    expect(read.headers.get('content-type')).toMatch(/^application\/json/);
    await call('POST', '/api/admin/guild-chat', { guild: id });
    expect(audit(ctx)).toEqual([
      {
        actor: 'u_Boss',
        category: 'admin.read',
        action: 'guildChat',
        target: null,
        outcome: 'ok',
        detail: JSON.stringify({ guild: id }),
      },
      {
        actor: 'u_Boss',
        category: 'admin.read',
        action: 'guildChat',
        target: null,
        outcome: 'ok',
        detail: JSON.stringify({ guild: id }),
      },
    ]);
  });

  it('refuses an unknown guild and a round without guilds, and records both', async () => {
    const { ctx, call } = await asAdmin();
    const id = guild(ctx);
    const unknown = await call('POST', '/api/admin/guild-chat', {
      guild: 'none',
    });
    expect(unknown.status).toBe(400);
    expect(unknown.json).toEqual({ error: 'Diese Gilde gibt es nicht.' });
    ctx.admin.putSettings([['roundGuilds', 0]]);
    const off = await call('POST', '/api/admin/guild-chat', { guild: id });
    expect(off.status).toBe(400);
    expect(off.json).toEqual({
      error: 'Gilden sind in dieser Runde abgeschaltet.',
    });
    expect(off.text).not.toContain('alert');
    expect(audit(ctx).map((r) => [r.outcome, r.detail])).toEqual([
      ['rejected', JSON.stringify({ guild: 'none' })],
      ['rejected', JSON.stringify({ guild: id })],
    ]);
  });

  it('is only for the admin', async () => {
    const { ctx, call } = await asAdmin();
    const id = guild(ctx);
    await call('POST', '/api/logout', {});
    await call('POST', '/api/login', { name: 'Lea', password: 'secret1' });
    const refused = await call('POST', '/api/admin/guild-chat', { guild: id });
    expect(refused.status).toBe(400);
    expect(refused.json).toEqual({ error: 'Nur der Admin darf das.' });
    expect(refused.text).not.toContain('alert');
    expect(audit(ctx)).toEqual([]);
  });
});
