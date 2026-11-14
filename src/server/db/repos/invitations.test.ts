import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';
import type { Invitation } from './invitations.ts';

const inv: Invitation = {
  id: 'i1',
  email: 'a@b.cd',
  tokenHash: 'h1',
  createdBy: null,
  created: 10,
  expires: 100,
  usedAt: null,
  revokedAt: null,
};

describe('invitations repository', () => {
  it('adds an invitation and finds it by its token', () => {
    const ctx = testCtx();
    addUser(ctx, 'Boss');
    const full = { ...inv, createdBy: 'u_Boss', usedAt: 5, revokedAt: 6 };
    ctx.invitations.add(full);
    expect(ctx.invitations.byToken('h1')).toEqual(full);
    expect(ctx.invitations.byToken('nope')).toBeNull();
  });

  it('lists the open invitations, the newest first', () => {
    const ctx = testCtx();
    ctx.invitations.add(inv);
    ctx.invitations.add({ ...inv, id: 'i3', tokenHash: 'h3', created: 20 });
    ctx.invitations.add({ ...inv, id: 'i2', tokenHash: 'h2', created: 20 });
    ctx.invitations.add({ ...inv, id: 'i4', tokenHash: 'h4', usedAt: 1 });
    ctx.invitations.add({ ...inv, id: 'i5', tokenHash: 'h5', revokedAt: 1 });
    expect(ctx.invitations.open(99).map((i) => i.id)).toEqual([
      'i2',
      'i3',
      'i1',
    ]);
    expect(ctx.invitations.open(100)).toEqual([]);
  });

  it('revokes the open invitations of an address or one by id', () => {
    const ctx = testCtx();
    ctx.invitations.add(inv);
    ctx.invitations.add({ ...inv, id: 'i2', tokenHash: 'h2' });
    ctx.invitations.add({ ...inv, id: 'i3', tokenHash: 'h3', email: 'x@y.z' });
    expect(ctx.invitations.revoke({ id: 'i3' }, 50)).toBe(1);
    expect(ctx.invitations.byToken('h3')?.revokedAt).toBe(50);
    expect(ctx.invitations.revoke({ email: 'A@B.CD' }, 60)).toBe(2);
    expect(ctx.invitations.revoke({ email: 'a@b.cd' }, 61)).toBe(0);
    expect(ctx.invitations.byToken('h1')?.revokedAt).toBe(60);
    expect(ctx.invitations.revoke({}, 62)).toBe(0);
  });

  it('marks an invitation as used, which ends it', () => {
    const ctx = testCtx();
    ctx.invitations.add(inv);
    ctx.invitations.add({ ...inv, id: 'i2', tokenHash: 'h2' });
    ctx.invitations.use('i1', 70);
    expect(ctx.invitations.byToken('h1')?.usedAt).toBe(70);
    expect(ctx.invitations.byToken('h2')?.usedAt).toBeNull();
    expect(ctx.invitations.revoke({ id: 'i1' }, 80)).toBe(0);
  });
});
