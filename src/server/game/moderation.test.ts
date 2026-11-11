import { describe, expect, it } from 'vitest';
import { type AuditEntry, DAY } from '../audit.ts';
import { addUser, testCtx } from '../test-helpers.ts';
import { GameError } from './context.ts';
import { ensureActive, moderate, suspension } from './moderation.ts';

function setup() {
  const ctx = testCtx();
  const admin = addUser(ctx, 'Admin', { admin: true });
  const player = addUser(ctx, 'Player');
  const db = ctx.store.db;
  const session = db.prepare('INSERT INTO sessions VALUES (?, ?, 9e9)');
  session.run('s1', player.id);
  session.run('s2', player.id);
  session.run('s3', admin.id);
  const token = db.prepare(
    'INSERT INTO account_tokens (token_hash, user_id, purpose, expires) VALUES (?, ?, ?, 9e9)',
  );
  token.run('t-login', player.id, 'login');
  token.run('t-reset', player.id, 'reset');
  const run = (action: string, body: Record<string, unknown>) => {
    const entry: AuditEntry = { category: 'admin.write', action };
    moderate(ctx, admin, { player: player.id, reason: 'Spam', ...body }, entry);
    return entry;
  };
  const count = (table: string) =>
    (
      db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
        .get(player.id) as { n: number }
    ).n;
  return { ctx, admin, player, run, count };
}

const refuses = (f: () => unknown, message: string) =>
  expect(f).toThrow(new GameError(message));

describe('moderation', () => {
  it('bans for whole hours up to 720 and records before and after', () => {
    const { ctx, player, run, count } = setup();
    const entry = run('ban', { hours: 2 });
    const until = ctx.now() + (2 * DAY) / 24;
    expect(suspension(ctx, player.id)).toEqual({ reason: 'Spam', until });
    expect(entry.detail).toEqual({
      reason: 'Spam',
      before: null,
      after: { reason: 'Spam', until },
      sessions: 2,
    });
    expect(count('sessions')).toBe(0);
    expect(count('account_tokens')).toBe(1);
    refuses(() => ensureActive(ctx, player.id), 'Dieses Konto ist gesperrt.');

    const again = run('ban', { hours: 720, reason: 'Again' });
    expect(again.detail).toMatchObject({
      before: { reason: 'Spam', until },
      after: { reason: 'Again', until: ctx.now() + 30 * DAY },
      sessions: 0,
    });
  });

  it('bans without an end for 0 hours or no duration', () => {
    const { ctx, player, run } = setup();
    run('ban', {});
    expect(suspension(ctx, player.id)).toEqual({ reason: 'Spam', until: null });
    run('ban', { hours: 0 });
    expect(suspension(ctx, player.id)?.until).toBeNull();
  });

  it('refuses durations outside 0 to 720 whole hours', () => {
    const { ctx, player, run } = setup();
    for (const hours of [-1, 721, 1.5, 'x'])
      refuses(() => run('ban', { hours }), 'Sperrdauer: 0 bis 720 Stunden.');
    expect(suspension(ctx, player.id)).toBeUndefined();
  });

  it('a ban ends with its time; unban lifts it at once', () => {
    const { ctx, player, run } = setup();
    run('ban', { hours: 1 });
    ctx.clock.t += DAY / 24 - 1;
    expect(suspension(ctx, player.id)).toBeDefined();
    ctx.clock.t += 1;
    expect(suspension(ctx, player.id)).toBeUndefined();
    expect(() => ensureActive(ctx, player.id)).not.toThrow();

    run('ban', {});
    const entry = run('unban', {});
    expect(entry.detail).toMatchObject({
      before: { reason: 'Spam', until: null },
      after: null,
      sessions: 0,
    });
    expect(suspension(ctx, player.id)).toBeUndefined();
  });

  it('revoking sessions signs out without a ban', () => {
    const { ctx, player, run, count } = setup();
    const entry = run('revokeSessions', {});
    expect(entry.detail).toEqual({
      reason: 'Spam',
      before: null,
      after: null,
      sessions: 2,
    });
    expect(suspension(ctx, player.id)).toBeUndefined();
    expect(count('sessions')).toBe(0);
    expect(count('account_tokens')).toBe(1);
  });

  it('refuses unknown players, admins, oneself and a missing reason', () => {
    const { ctx, admin, player, run } = setup();
    const other = addUser(ctx, 'Other', { admin: true });
    const entry: AuditEntry = { category: 'admin.write', action: 'ban' };
    refuses(
      () => moderate(ctx, admin, { player: 'nobody', reason: 'x' }, entry),
      'Spieler nicht gefunden.',
    );
    const serverOnly = 'Dieses Konto kann nur auf dem Server verwaltet werden.';
    refuses(
      () => moderate(ctx, admin, { player: admin.id, reason: 'x' }, entry),
      serverOnly,
    );
    refuses(
      () => moderate(ctx, admin, { player: other.id, reason: 'x' }, entry),
      serverOnly,
    );
    refuses(() => run('ban', { reason: '   ' }), 'Bitte einen Grund angeben.');
    expect(suspension(ctx, player.id)).toBeUndefined();
    expect(entry.detail).toBeUndefined();
  });

  it('refuses moderating oneself even without the admin flag', () => {
    const { ctx, player } = setup();
    const entry: AuditEntry = { category: 'admin.write', action: 'ban' };
    refuses(
      () => moderate(ctx, player, { player: player.id, reason: 'x' }, entry),
      'Dieses Konto kann nur auf dem Server verwaltet werden.',
    );
    expect(suspension(ctx, player.id)).toBeUndefined();
  });
});
