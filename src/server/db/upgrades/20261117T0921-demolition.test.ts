// Upgrade test of migration 20261117T0921-demolition (#202): what a
// demolition of the build queue gives back at its end. Every order of a
// running round stays an upgrade (no value), with its cost and level, and
// everything else stays; the store then keeps a demolition.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/202/migrations.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

const ID = '20261117T0921-demolition';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna upgrades her shipyard, Bert has an idle planet. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 0),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind,
      bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c, bq_cost_d) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet',
        'yard', 3, 1763300000000, 1763300500000, 1600, 800, 400),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet',
        NULL, NULL, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO planet_buildings VALUES ('p1_2_3', 'yard', 2), ('p1_4_7', 'metal', 4);
    INSERT INTO settings (key, value) VALUES ('round', 2), ('speed', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds nothing to give back to every planet and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planet_buildings', 'settings'];
    const old = tables.map((t) => all(db, t));
    const planets = all(db, 'planets');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'planets')).toEqual(
      planets.map((p) => ({
        ...p,
        bq_back_m: null,
        bq_back_c: null,
        bq_back_d: null,
      })),
    );
    db.close();
  });

  it('leaves a running upgrade an upgrade; the store keeps a demolition', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const store = new Store(db);
    const anna = store.planet('p1_2_3')!;
    expect(anna.bq).toEqual({
      key: 'yard',
      lvl: 3,
      start: 1763300000000,
      end: 1763300500000,
      cost: [1600, 800, 400],
    });
    expect(store.planet('p1_4_7')!.bq).toBeNull();
    const back = [400, 200, 100] as const;
    store.savePlanet({
      ...anna,
      bq: { key: 'yard', lvl: 1, start: 5, end: 9, cost: [0, 0, 0], back },
    });
    expect(
      db
        .prepare(
          'SELECT bq_lvl, bq_back_m, bq_back_c, bq_back_d FROM planets WHERE id = ?',
        )
        .get('p1_2_3'),
    ).toEqual({ bq_lvl: 1, bq_back_m: 400, bq_back_c: 200, bq_back_d: 100 });
    expect(store.planet('p1_2_3')!.bq).toEqual({
      key: 'yard',
      lvl: 1,
      start: 5,
      end: 9,
      cost: [0, 0, 0],
      back: [400, 200, 100],
    });
    store.savePlanet({ ...anna, bq: null });
    expect(
      db
        .prepare('SELECT bq_key, bq_back_m FROM planets WHERE id = ?')
        .get('p1_2_3'),
    ).toEqual({ bq_key: null, bq_back_m: null });
    db.close();
  });
});
