import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

describe('players repository', () => {
  it('saves and reads a player by id, name and address', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', {
      admin: true,
      probes: 4,
      explain: 'always',
      readAt: 7,
      research: { energy: 3, laser: 1 },
      rq: {
        key: 'laser',
        lvl: 2,
        start: 1,
        end: 9,
        cost: [1, 2, 3],
        planet: 'p1',
      },
    });
    expect(ctx.players.get(u.id)).toEqual(u);
    expect(ctx.players.byName('ANNA')).toEqual(u);
    expect(ctx.players.byEmail('Anna@Example.org')).toEqual(u);
    expect(ctx.players.get('nobody')).toBeNull();
    expect(ctx.players.byName('nobody')).toBeNull();
    expect(ctx.players.byEmail('nobody@example.org')).toBeNull();
  });

  it('replaces the research and clears the queue on save', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', {
      research: { energy: 3, laser: 1 },
      rq: { key: 'laser', lvl: 2, start: 1, end: 9, cost: [1, 2, 3] },
    });
    expect(ctx.players.get(u.id)!.rq).toEqual({
      key: 'laser',
      lvl: 2,
      start: 1,
      end: 9,
      cost: [1, 2, 3],
    });
    const next = { ...u, research: { energy: 4 }, rq: null, admin: false };
    ctx.players.save(next);
    expect(ctx.players.get(u.id)).toEqual(next);
    expect(ctx.db.prepare('SELECT admin, rq_key FROM users').get()).toEqual({
      admin: 0,
      rq_key: null,
    });
  });

  it('keeps an empty address empty', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { email: null });
    expect(ctx.players.get(u.id)!.email).toBeNull();
  });

  it('lists the players, the oldest first', () => {
    const ctx = testCtx();
    addUser(ctx, 'Cora', { created: 5 });
    addUser(ctx, 'Bert', { created: 1 });
    addUser(ctx, 'Anna', { created: 5 });
    expect(ctx.players.all().map((u) => u.name)).toEqual([
      'Bert',
      'Anna',
      'Cora',
    ]);
  });

  it('opens, finds and ends sessions', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    ctx.players.addSession('h1', 'u_Anna', 100);
    ctx.players.addSession('h2', 'u_Anna', 200);
    ctx.players.addSession('h3', 'u_Bert', 300);
    expect(ctx.players.sessionUser('h1', 99)).toBe('u_Anna');
    expect(ctx.players.sessionUser('h1', 100)).toBeNull();
    expect(ctx.players.sessionUser('nope', 0)).toBeNull();
    expect(ctx.players.purgeSessions(100)).toBe(1);
    expect(ctx.players.purgeSessions(100)).toBe(0);
    ctx.players.deleteSession('h2');
    expect(ctx.players.sessionUser('h2', 0)).toBeNull();
    expect(ctx.players.sessionUser('h3', 0)).toBe('u_Bert');
  });

  it('ends every session and the login codes of one player', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    ctx.players.addSession('a1', 'u_Anna', 100);
    ctx.players.addSession('a2', 'u_Anna', 100);
    ctx.players.addSession('b1', 'u_Bert', 100);
    ctx.db.exec(`
      INSERT INTO account_tokens (token_hash, user_id, purpose, expires) VALUES
        ('t1', 'u_Anna', 'login', 9), ('t2', 'u_Anna', 'reset', 9),
        ('t3', 'u_Bert', 'login', 9);
    `);
    ctx.players.deleteLoginTokens('u_Anna');
    expect(
      ctx.db
        .prepare('SELECT token_hash FROM account_tokens ORDER BY token_hash')
        .pluck()
        .all(),
    ).toEqual(['t2', 't3']);
    expect(ctx.players.deleteSessions('u_Anna')).toBe(2);
    expect(ctx.players.deleteSessions('u_Anna')).toBe(0);
    expect(ctx.players.sessionUser('b1', 0)).toBe('u_Bert');
  });
});
