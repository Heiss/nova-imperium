import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../../test-helpers.ts';
import { openDatabase } from '../database.ts';
import { repositories } from './index.ts';

describe('repositories', () => {
  it('builds one repository per aggregate on the same database', () => {
    const db = openDatabase(':memory:');
    const repos = repositories(db);
    expect(Object.keys(repos)).toEqual([
      'players',
      'planets',
      'fleets',
      'reports',
      'guilds',
      'invitations',
      'admin',
    ]);
    db.exec(
      "INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Alt', 's', 'h', 1)",
    );
    expect(repos.players.get('u1')?.name).toBe('Alt');
  });

  it('leave the transaction to the caller: one unit of work, all or nothing', () => {
    const ctx = testCtx();
    expect(() =>
      ctx.tx(() => {
        const u = addUser(ctx, 'Anna');
        addPlanet(ctx, u.id);
        ctx.reports.add(
          u.id,
          { id: 'r1', time: 1, type: 'info', title: 'T' },
          5,
        );
        ctx.guilds.create('g1', 'ABC', 'Alpha', '', u.id);
        ctx.admin.putSettings([['round', 2]]);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(ctx.players.all()).toEqual([]);
    expect(ctx.planets.all()).toEqual([]);
    expect(ctx.guilds.all()).toEqual([]);
    expect(ctx.admin.roundSettings()).toEqual([]);
    expect(ctx.tx(() => 5)).toBe(5);
  });
});
