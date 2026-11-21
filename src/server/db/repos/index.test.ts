import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../../test-helpers.ts';
import { openDatabase } from '../database.ts';
import { REPOSITORIES } from './repositories.gen.ts';
import { assembleRepositories, type Listed, repositories } from './index.ts';

// The rules that hold for every repository (#317). The test names no
// repository and no count: a repository registers itself in its own module
// (`repository`) and is tested in its own test file.
const modules: Listed = REPOSITORIES;
const KEY = /^[a-z][a-zA-Z0-9]*$/;
/** What `Ctx` carries besides the repositories: a repository may not take these keys. */
const CTX_KEYS = ['tx', 'db', 'now', 'rng', 'id'];

describe('the list of the repositories', () => {
  it('names each module once, by its file in this folder', () => {
    const names = modules.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('gives every repository a plain key, not one of Ctx, and a make function', () => {
    for (const [name, { key, make }] of modules) {
      expect(key, name).toMatch(KEY);
      expect(CTX_KEYS, name).not.toContain(key);
      expect(typeof make, name).toBe('function');
    }
  });

  it('defines no key twice', () => {
    const keys = modules.map(([, m]) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('builds exactly the listed keys on one database', () => {
    const db = openDatabase(':memory:');
    const repos = repositories(db);
    expect(Object.keys(repos).sort()).toEqual(
      modules.map(([, m]) => m.key).sort(),
    );
    db.exec(
      "INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Alt', 's', 'h', 1)",
    );
    expect(repos.players.get('u1')?.name).toBe('Alt');
  });

  it('throws when two modules use one key, naming both files', () => {
    const make = () => ({});
    expect(() =>
      assembleRepositories(openDatabase(':memory:'), [
        ['market', { key: 'market', make }],
        ['sales', { key: 'market', make }],
      ]),
    ).toThrow(
      'repository "market" is defined in src/server/db/repos/market.ts and in src/server/db/repos/sales.ts.',
    );
  });
});

describe('repositories', () => {
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
    expect(ctx.admin.setting('round')).toBeUndefined();
    expect(ctx.tx(() => 5)).toBe(5);
  });
});
