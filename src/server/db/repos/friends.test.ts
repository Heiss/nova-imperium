import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

// The buddy list (#227): one row per pair, an open request or a friendship.
function three() {
  const ctx = testCtx();
  for (const name of ['Anna', 'Bert', 'Cora']) addUser(ctx, name);
  return ctx;
}

describe('friends repository', () => {
  it('stores a request, seen by both, and nobody else', () => {
    const ctx = three();
    expect(ctx.friends.links('u_Anna')).toEqual([]);
    ctx.friends.request('u_Anna', 'u_Bert');
    const link = { from: 'u_Anna', to: 'u_Bert', status: 'pending' };
    expect(ctx.friends.links('u_Anna')).toEqual([link]);
    expect(ctx.friends.links('u_Bert')).toEqual([link]);
    expect(ctx.friends.links('u_Cora')).toEqual([]);
    ctx.db.close();
  });

  it('accepts only the request in its direction', () => {
    const ctx = three();
    ctx.friends.request('u_Anna', 'u_Bert');
    ctx.friends.accept('u_Bert', 'u_Anna');
    expect(ctx.friends.links('u_Anna')[0]!.status).toBe('pending');
    ctx.friends.accept('u_Anna', 'u_Bert');
    expect(ctx.friends.links('u_Bert')).toEqual([
      { from: 'u_Anna', to: 'u_Bert', status: 'friend' },
    ]);
    ctx.db.close();
  });

  it('lists every link of a player in a stable order', () => {
    const ctx = three();
    ctx.friends.request('u_Cora', 'u_Anna');
    ctx.friends.request('u_Anna', 'u_Bert');
    expect(ctx.friends.links('u_Anna').map((l) => l.from + l.to)).toEqual([
      'u_Annau_Bert',
      'u_Corau_Anna',
    ]);
    ctx.db.close();
  });

  it('removes the row of a pair from either side and only that one', () => {
    const ctx = three();
    ctx.friends.request('u_Anna', 'u_Bert');
    ctx.friends.request('u_Cora', 'u_Anna');
    ctx.friends.remove('u_Bert', 'u_Anna');
    expect(ctx.friends.links('u_Anna')).toEqual([
      { from: 'u_Cora', to: 'u_Anna', status: 'pending' },
    ]);
    ctx.friends.remove('u_Cora', 'u_Anna');
    expect(ctx.friends.links('u_Anna')).toEqual([]);
    ctx.db.close();
  });

  it('refuses a second row of a pair, a crossed one and one with oneself', () => {
    const ctx = three();
    ctx.friends.request('u_Anna', 'u_Bert');
    expect(() => ctx.friends.request('u_Anna', 'u_Bert')).toThrow();
    expect(() => ctx.friends.request('u_Bert', 'u_Anna')).toThrow();
    expect(() => ctx.friends.request('u_Cora', 'u_Cora')).toThrow();
    expect(() => ctx.friends.request('u_Cora', 'u_Nobody')).toThrow();
    ctx.db.close();
  });

  it('forgets the rows of a deleted account', () => {
    const ctx = three();
    ctx.friends.request('u_Anna', 'u_Bert');
    ctx.friends.accept('u_Anna', 'u_Bert');
    ctx.friends.request('u_Cora', 'u_Anna');
    ctx.db.prepare('DELETE FROM users WHERE id = ?').run('u_Anna');
    expect(ctx.friends.links('u_Bert')).toEqual([]);
    expect(ctx.friends.links('u_Cora')).toEqual([]);
    ctx.db.close();
  });
});
