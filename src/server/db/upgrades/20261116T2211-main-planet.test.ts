// Upgrade test of migration 20261116T2211-main-planet (#221): the main
// planet a player chose and the time of the last switch. Every existing
// player starts without a choice, so the main planet stays the first planet
// and nothing is locked; everything else stays.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/221/migrations.ts';
import { Store } from '../store.ts';
import { MIGRATIONS } from '../schema.ts';
import { createCtx } from '../../game/context.ts';
import { mainPlanetOf } from '../../game/main-planet.ts';

const ID = '20261116T2211-main-planet';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna with her home planet, a colony and a moon, Bert with research on his home planet. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at,
      rq_key, rq_lvl, rq_start, rq_end, rq_cost_m, rq_cost_c, rq_cost_d, rq_planet) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 1763290000000,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0,
        'energy', 2, 10, 20, 0, 1600, 800, 'p1_4_7');
    INSERT INTO user_research VALUES ('u_Bert', 'energy', 1);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p2_5_9', 'u_Anna', 'Kolonie', 2, 5, 9, -10, 10, 0, 0, 1763300000000, 1763290000000, 'planet'),
      ('m1_2_3', 'u_Anna', 'Mond', 1, 2, 3, 40, 0, 0, 0, 1763300000000, 1763295000000, 'moon'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet');
    INSERT INTO settings (key, value) VALUES ('round', 2), ('speed', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty choice and switch time to every player and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['planets', 'user_research', 'settings'];
    const old = tables.map((t) => all(db, t));
    const users = all(db, 'users');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'users')).toEqual(
      users.map((u) => ({ ...u, main_planet: null, main_switched: null })),
    );
    db.close();
  });

  it('leaves every player the first planet as the main planet, unlocked; the store keeps a choice', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const store = new Store(db);
    const ctx = createCtx(store, { now: () => 1763300000000 });
    for (const [uid, home] of [
      ['u_Anna', 'p1_2_3'],
      ['u_Bert', 'p1_4_7'],
    ] as const) {
      const u = store.user(uid)!;
      expect(u).toMatchObject({ mainPlanet: null, mainSwitched: null });
      const main = mainPlanetOf(ctx, u);
      expect(main.planet?.id).toBe(home);
      expect(main.lockEnd).toBeNull();
    }
    expect(store.user('u_Bert')!.rq).toMatchObject({ planet: 'p1_4_7' });
    const anna = store.user('u_Anna')!;
    store.saveUser({
      ...anna,
      mainPlanet: 'p2_5_9',
      mainSwitched: 1763300000000,
    });
    expect(
      db
        .prepare('SELECT main_planet, main_switched FROM users WHERE id = ?')
        .get('u_Anna'),
    ).toEqual({ main_planet: 'p2_5_9', main_switched: 1763300000000 });
    expect(store.user('u_Anna')).toMatchObject({
      probes: 3,
      mainPlanet: 'p2_5_9',
      mainSwitched: 1763300000000,
    });
    db.close();
  });
});
