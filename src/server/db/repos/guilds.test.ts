import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';

const setup = () => {
  const ctx = testCtx();
  for (const name of ['Anna', 'Bert', 'Cora']) addUser(ctx, name);
  ctx.guilds.create('g1', 'ABC', 'Alpha', 'Text', 'u_Anna');
  return ctx;
};

describe('guilds repository', () => {
  it('founds a guild with its founder as the first member', () => {
    const ctx = setup();
    expect(ctx.guilds.get('g1')).toEqual({
      id: 'g1',
      tag: 'ABC',
      name: 'Alpha',
      description: 'Text',
      founder: 'u_Anna',
    });
    expect(ctx.guilds.get('none')).toBeUndefined();
    expect(ctx.guilds.membership('u_Anna')).toEqual({
      user_id: 'u_Anna',
      guild_id: 'g1',
      status: 'member',
    });
    expect(ctx.guilds.membership('u_Bert')).toBeUndefined();
  });

  it('finds a tag or name taken by another guild', () => {
    const ctx = setup();
    expect(ctx.guilds.taken('', 'abc', 'Other')).toBe(true);
    expect(ctx.guilds.taken('', 'XYZ', 'alpha')).toBe(true);
    expect(ctx.guilds.taken('', 'XYZ', 'Other')).toBe(false);
    expect(ctx.guilds.taken('g1', 'ABC', 'Alpha')).toBe(false);
  });

  it('updates the profile and hands over the lead', () => {
    const ctx = setup();
    ctx.guilds.update('g1', 'NEW', 'Beta', 'More');
    ctx.guilds.transfer('g1', 'u_Bert');
    expect(ctx.guilds.get('g1')).toEqual({
      id: 'g1',
      tag: 'NEW',
      name: 'Beta',
      description: 'More',
      founder: 'u_Bert',
    });
  });

  it('takes applications, accepts and removes members', () => {
    const ctx = setup();
    ctx.guilds.apply('u_Bert', 'g1');
    ctx.guilds.apply('u_Cora', 'g1');
    expect(ctx.guilds.membership('u_Bert')?.status).toBe('pending');
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Anna')).toBe(false);
    ctx.guilds.accept('u_Bert');
    expect(ctx.guilds.membership('u_Bert')?.status).toBe('member');
    expect(ctx.guilds.membership('u_Cora')?.status).toBe('pending');
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Anna')).toBe(true);
    expect(ctx.guilds.hasOtherMembers('g1', 'u_Bert')).toBe(true);
    expect(ctx.guilds.hasOtherMembers('g2', 'u_Anna')).toBe(false);
    ctx.guilds.removeMember('u_Bert');
    expect(ctx.guilds.membership('u_Bert')).toBeUndefined();
    expect(ctx.guilds.membership('u_Cora')?.status).toBe('pending');
  });

  it('lists all guilds and their players, and deletes a guild', () => {
    const ctx = setup();
    ctx.guilds.create('g2', 'XYZ', 'Zeta', '', 'u_Bert');
    ctx.guilds.apply('u_Cora', 'g2');
    expect(ctx.guilds.all().map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(
      ctx.guilds.players().sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      { id: 'u_Anna', name: 'Anna', guild_id: 'g1', status: 'member' },
      { id: 'u_Bert', name: 'Bert', guild_id: 'g2', status: 'member' },
      { id: 'u_Cora', name: 'Cora', guild_id: 'g2', status: 'pending' },
    ]);
    ctx.guilds.delete('g2');
    expect(ctx.guilds.all().map((g) => g.id)).toEqual(['g1']);
    expect(ctx.guilds.membership('u_Cora')).toBeUndefined();
  });
});
