import { describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../shared/universe.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { migrate, openDatabase } from './database.ts';
import { MIGRATIONS } from './schema.ts';

describe('database', () => {
  it('migrates once and refuses a newer schema', () => {
    const db = openDatabase(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
    expect(migrate(db)).toBe(0);
    expect(migrate(db, [...MIGRATIONS, 'CREATE TABLE x (a INTEGER)'])).toBe(1);
    expect(() => migrate(db)).toThrow(/newer image/);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('store', () => {
  it('keeps the universe settings with defaults', () => {
    const { store } = testCtx();
    expect(store.universe()).toEqual(DEFAULT_UNIVERSE);
    store.saveUniverse({ ...DEFAULT_UNIVERSE, speed: 9 });
    store.saveUniverse({ ...DEFAULT_UNIVERSE, speed: 10 });
    expect(store.universe().speed).toBe(10);
  });

  it('saves and reads users with research and queue', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', {
      admin: true,
      research: { energy: 3, laser: 1 },
      rq: { key: 'laser', lvl: 2, start: 1, end: 9, cost: [1, 2, 3] },
    });
    expect(ctx.store.user(u.id)).toEqual(u);
    expect(ctx.store.userByName('anna')?.id).toBe(u.id);
    expect(ctx.store.userByEmail('ANNA@example.org')?.id).toBe(u.id);
    u.research = { energy: 4 };
    u.rq = null;
    u.admin = false;
    ctx.store.saveUser(u);
    expect(ctx.store.user(u.id)).toEqual(u);
    expect(ctx.store.user('nobody')).toBeNull();
    addUser(ctx, 'Bert');
    expect(ctx.store.users().map((x) => x.name)).toEqual(['Anna', 'Bert']);
  });

  it('saves the display option of the explanation texts (issue #63)', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    expect(ctx.store.user(u.id)!.explain).toBe('icon');
    for (const mode of ['always', 'hidden', 'icon'] as const) {
      ctx.store.saveUser({ ...u, explain: mode });
      expect(ctx.store.user(u.id)!.explain).toBe(mode);
    }
  });

  it('reads the default display option of a player stored without one', () => {
    const ctx = testCtx();
    ctx.store.db
      .prepare(
        `INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u1', 'Alt', 's', 'h', 1)`,
      )
      .run();
    expect(ctx.store.user('u1')!.explain).toBe('icon');
  });

  it('refuses a second user with the same name in other case', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(() =>
      addUser(ctx, 'ANNA', { id: 'other', email: 'x@y.z' }),
    ).toThrow();
  });

  it('saves a planet with all its parts and replaces them', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const p = addPlanet(ctx, 'u_Anna', {
      b: { metal: 3, lab: 1 },
      ships: { lf: 2, sc: 0 },
      def: { rl: 4 },
      pct: { metal: 50 },
      sq: [
        { key: 'lf', n: 2, unit: 1000.5 },
        { key: 'rl', n: 1, unit: 50 },
      ],
      sqT: 77,
      bq: { key: 'metal', lvl: 4, start: 1, end: 2, cost: [3, 4, 5] },
    });
    const back = ctx.store.planet(p.id)!;
    expect(back).toEqual({
      ...p,
      ships: { lf: 2 },
      sq: [{ ...p.sq[0], unit: 1001 }, p.sq[1]],
    });
    back.b = { metal: 4 };
    back.def = {};
    back.sq = [];
    back.sqT = null;
    back.bq = null;
    ctx.store.savePlanet(back);
    expect(ctx.store.planet(p.id)).toEqual(back);
    expect(ctx.store.planet('none')).toBeNull();
  });

  it('finds the home planet, all planets and the used size', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(ctx.store.usedSize()).toEqual({ g: 0, s: 0, p: 0 });
    addPlanet(ctx, 'u_Anna', { g: 2, s: 7, p: 4, created: 5 });
    addPlanet(ctx, 'u_Anna', { g: 1, s: 30, p: 13, created: 9 });
    expect(ctx.store.planetOfUser('u_Anna')?.id).toBe('p2_7_4');
    expect(ctx.store.planets().map((p) => p.id)).toEqual([
      'p1_30_13',
      'p2_7_4',
    ]);
    expect(ctx.store.usedSize()).toEqual({ g: 2, s: 30, p: 13 });
    ctx.store.deleteAllPlanets();
    expect(ctx.store.planets()).toEqual([]);
    expect(ctx.store.planetOfUser('u_Anna')).toBeNull();
  });

  it('saves fleets and finds the due ones in time order', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const base = {
      owner: 'u_Anna',
      from: 'a',
      fromC: { g: 1, s: 1, p: 1 },
      to: 'b',
      toC: { g: 1, s: 2, p: 3 },
      mission: 'attack' as const,
      ships: { lf: 3, sc: 0 },
      cargo: { m: 1, c: 2, d: 3 },
      dep: 0,
      recalled: false,
      fuel: 41,
    };
    ctx.store.saveFleet({ ...base, id: 'f1', arr: 50, ret: 100, state: 'out' });
    ctx.store.saveFleet({ ...base, id: 'f2', arr: 10, ret: 40, state: 'back' });
    ctx.store.saveFleet({ ...base, id: 'f3', arr: 70, ret: 140, state: 'out' });
    expect(ctx.store.fleet('f1')).toEqual({
      ...base,
      id: 'f1',
      arr: 50,
      ret: 100,
      state: 'out',
      ships: { lf: 3 },
    });
    expect(ctx.store.dueFleets(60).map((f) => f.id)).toEqual(['f2', 'f1']);
    expect(ctx.store.dueFleets(39).map((f) => f.id)).toEqual([]);
    expect(ctx.store.dueFleets(40).map((f) => f.id)).toEqual(['f2']);
    expect(ctx.store.fleetCount('u_Anna')).toBe(3);
    const f = ctx.store.fleet('f1')!;
    f.state = 'back';
    f.recalled = true;
    f.ret = 77;
    f.cargo = { m: 9, c: 8, d: 7 };
    f.ships = { lf: 1 };
    ctx.store.saveFleet(f);
    expect(ctx.store.fleet('f1')).toEqual(f);
    expect(ctx.store.fleets().map((x) => x.id)).toEqual(['f1', 'f2', 'f3']);
    ctx.store.deleteFleet('f1');
    expect(ctx.store.fleet('f1')).toBeNull();
    ctx.store.deleteAllFleets();
    expect(ctx.store.fleets()).toEqual([]);
  });

  it('keeps the newest reports up to the limit', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    for (let i = 1; i <= 5; i++)
      ctx.store.addReport(
        'u_Anna',
        {
          id: `r${i}`,
          time: 100 - i,
          type: 'info',
          title: `T${i}`,
          text: `x${i}`,
        },
        3,
      );
    const list = ctx.store.reports('u_Anna');
    expect(list.map((r) => r.id)).toEqual(['r5', 'r4', 'r3']);
    expect(list[0]).toEqual({
      id: 'r5',
      time: 95,
      type: 'info',
      title: 'T5',
      text: 'x5',
    });
    ctx.store.deleteReport('u_Anna', 'r4');
    expect(ctx.store.reports('u_Anna').map((r) => r.id)).toEqual(['r5', 'r3']);
    ctx.store.deleteReports('u_Anna');
    expect(ctx.store.reports('u_Anna')).toEqual([]);
  });

  it('handles sessions with expiry', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.store.addSession('h1', 'u_Anna', 100);
    ctx.store.addSession('h2', 'u_Anna', 200);
    expect(ctx.store.sessionUser('h1', 99)).toBe('u_Anna');
    expect(ctx.store.sessionUser('h1', 100)).toBeNull();
    expect(ctx.store.sessionUser('nope', 0)).toBeNull();
    expect(ctx.store.purgeSessions(100)).toBe(1);
    ctx.store.deleteSession('h2');
    expect(ctx.store.sessionUser('h2', 0)).toBeNull();
  });

  it('handles invitations', () => {
    const ctx = testCtx();
    const inv = {
      id: 'i1',
      email: 'a@b.cd',
      tokenHash: 'h1',
      createdBy: null,
      created: 10,
      expires: 100,
      usedAt: null,
      revokedAt: null,
    };
    ctx.store.addInvitation(inv);
    ctx.store.addInvitation({
      ...inv,
      id: 'i2',
      tokenHash: 'h2',
      email: 'x@y.zz',
      created: 20,
    });
    expect(ctx.store.invitationByToken('h1')).toEqual(inv);
    expect(ctx.store.invitationByToken('nope')).toBeNull();
    expect(ctx.store.openInvitations(50).map((i) => i.id)).toEqual([
      'i2',
      'i1',
    ]);
    expect(ctx.store.openInvitations(100)).toEqual([]);
    expect(ctx.store.revokeInvitations({ email: 'A@B.CD' }, 60)).toBe(1);
    expect(ctx.store.revokeInvitations({ email: 'a@b.cd' }, 61)).toBe(0);
    expect(ctx.store.invitationByToken('h1')?.revokedAt).toBe(60);
    ctx.store.useInvitation('i2', 70);
    expect(ctx.store.revokeInvitations({ id: 'i2' }, 80)).toBe(0);
    expect(ctx.store.openInvitations(50)).toEqual([]);
  });

  it('removes everything of a deleted user (foreign keys)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { b: { metal: 1 } });
    ctx.store.db.prepare('DELETE FROM users').run();
    expect(
      ctx.store.db.prepare('SELECT COUNT(*) AS n FROM planet_buildings').get(),
    ).toEqual({ n: 0 });
  });

  it('runs a transaction all or nothing', () => {
    const ctx = testCtx();
    expect(() =>
      ctx.store.tx(() => {
        addUser(ctx, 'Anna');
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(ctx.store.users()).toEqual([]);
    expect(ctx.store.tx(() => 5)).toBe(5);
  });
});
