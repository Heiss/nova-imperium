// Upgrade test of migration 20261117T1000-vacation-mode (#223): when a
// player's vacation mode started. Every existing player starts outside of
// it, so the production goes on as before and every target stays open;
// everything else stays.
import { describe, expect, it } from 'vitest';
import { settle } from '../../../core/settle.ts';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/223/migrations.ts';
import { Store } from '../store.ts';
import { MIGRATIONS } from '../schema.ts';
import { createCtx, universe } from '../../game/context.ts';
import { inVacation } from '../../game/vacation.ts';

const ID = '20261117T1000-vacation-mode';
const through = migrationsThrough(ID);
const NOW = 1763300000000;
const HOUR = 3600000;

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna with her home planet and a moon, Bert with research and a chosen main planet. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at,
      rq_key, rq_lvl, rq_start, rq_end, rq_cost_m, rq_cost_c, rq_cost_d, rq_planet,
      main_planet, main_switched) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 1763290000000,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0,
        'energy', 2, 10, 20, 0, 1600, 800, 'p1_4_7', 'p1_4_7', 1763290000000);
    INSERT INTO user_research VALUES ('u_Bert', 'energy', 1);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, ${NOW}, 1763251200000, 'planet'),
      ('m1_2_3', 'u_Anna', 'Mond', 1, 2, 3, 40, 0, 0, 0, ${NOW}, 1763295000000, 'moon'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, ${NOW}, 1763251200000, 'planet');
    INSERT INTO settings (key, value) VALUES ('round', 2), ('speed', 3), ('roundMainLock', 5);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty vacation to every player and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['planets', 'user_research', 'settings'];
    const old = tables.map((t) => all(db, t));
    const users = all(db, 'users');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'users')).toEqual(
      users.map((u) => ({ ...u, vacation: null })),
    );
    db.close();
  });

  it('leaves every player outside the vacation mode, producing; the store keeps a vacation', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const store = new Store(db);
    const ctx = createCtx(store, { now: () => NOW + HOUR });
    for (const uid of ['u_Anna', 'u_Bert']) {
      expect(store.user(uid)).toMatchObject({ vacation: null });
      expect(inVacation(ctx)(uid)).toBe(false);
    }
    const planet = ctx.planets.get('p1_2_3')!;
    const anna = store.user('u_Anna')!;
    expect(
      settle(planet, NOW + HOUR, universe(ctx), anna).res.m,
    ).toBeGreaterThan(900);
    expect(store.user('u_Bert')).toMatchObject({
      mainPlanet: 'p1_4_7',
      rq: { planet: 'p1_4_7' },
    });
    store.saveUser({ ...anna, vacation: NOW });
    expect(
      db.prepare('SELECT vacation FROM users WHERE id = ?').get('u_Anna'),
    ).toEqual({ vacation: NOW });
    expect(store.user('u_Anna')).toMatchObject({ probes: 3, vacation: NOW });
    expect(inVacation(ctx)('u_Anna')).toBe(true);
    expect(
      settle(planet, NOW + HOUR, universe(ctx), store.user('u_Anna')).res,
    ).toEqual({ m: 900, c: 100, d: 50 });
    db.close();
  });
});
