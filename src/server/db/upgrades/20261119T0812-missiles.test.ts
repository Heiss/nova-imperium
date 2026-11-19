// Upgrade test of migration 20261119T0812-missiles (#54): fleets and
// fleet_ships are rebuilt for the mission Raketenangriff and the main target
// of its missiles. Every fleet in flight keeps its values, its gift and its
// ships and has no main target; the other tables stay; the new mission and
// a main target can be stored, an unknown mission still not.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/54/migrations.ts';
import { Store } from '../store.ts';
import type { Fleet } from '../../../core/types.ts';

const ID = '20261119T0812-missiles';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: two fleets in flight, one of them the gift of the „Endzeit“. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet'),
      ('p1_2_6', 'u_Bert', 'Beta', 1, 2, 6, 20, 500, 300, 0, 10, 2, 'planet');
    INSERT INTO planet_units (planet_id, kind, key, count) VALUES
      ('p1_1_5', 'defense', 'rl', 7), ('p1_2_6', 'ship', 'lf', 3);
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
        'attack', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 0),
      ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_5', 1, 1, 5,
        'deploy', 0, 0, 0, 4, 5, 6, 'out', 0, 0, 1),
      ('f3', 'u_Bert', 'p1_2_6', 1, 2, 6, 'd1_1_5', 1, 1, 5,
        'harvest', 0, 0, 0, 7, 8, 9, 'back', 1, 7, 0);
    INSERT INTO fleet_ships VALUES ('f1', 'lf', 2), ('f1', 'sc', 1),
      ('f2', 'lc', 42), ('f3', 'recycler', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('keeps every fleet with its ships and gift, without a main target, and the other tables', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets', 'planet_units', 'fleet_ships'];
    const old = tables.map((t) => all(db, t));
    const fleets = all(db, 'fleets');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'fleets')).toEqual(fleets.map((f) => ({ ...f, aim: null })));
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'old_%'")
        .all(),
    ).toEqual([]);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'fleets' AND sql IS NOT NULL",
        )
        .all(),
    ).toEqual([{ name: 'fleets_owner' }]);
    const store = new Store(db);
    expect(store.fleet('f2')).toMatchObject({ gift: true, ships: { lc: 42 } });
    expect(store.fleet('f1')).not.toHaveProperty('aim');
    db.close();
  });

  it('allows every mission of the game up to the missiles after the rebuilds of the Mondbruch, the Vermessung and the missiles, and keeps the columns (#95, #190, #54)', () => {
    const db = runningRound();
    migrate(db, through);
    // This rebuild lists the missions up to the Raketenangriff, the later
    // Expedition (#93) has its own rebuild; `aim` and `gift` stay.
    const columns = db
      .prepare("SELECT name FROM pragma_table_info('fleets')")
      .pluck()
      .all();
    expect(columns).toEqual(expect.arrayContaining(['gift', 'aim', 'fuel']));
    const ids = [
      'attack',
      'transport',
      'spy',
      'colonize',
      'deploy',
      'harvest',
      'moonbreak',
      'survey',
      'missile',
    ];
    for (const mission of ids)
      db.prepare(
        `INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
           mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, aim)
         VALUES (?, 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6, ?, 0, 0, 0, 1, 2, 3, 'out', ?)`,
      ).run(`x_${mission}`, mission, mission === 'missile' ? 'gauss' : null);
    expect(
      db
        .prepare("SELECT COUNT(*) FROM fleets WHERE id LIKE 'x_%'")
        .pluck()
        .get(),
    ).toBe(ids.length);
    // The CHECK lists exactly these missions.
    const sql = db
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'fleets'")
      .pluck()
      .get() as string;
    const allowed = /mission IN \(([^)]*)\)/
      .exec(sql)![1]!
      .split(',')
      .map((x) => x.trim().replaceAll("'", ''))
      .sort();
    expect(allowed).toEqual([...ids].sort());
    db.close();
  });

  it('stores missiles with and without a main target; ships still go with their fleet', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    const missiles = {
      ...store.fleet('f1')!,
      id: 'f4',
      mission: 'missile' as const,
      ships: { ipm: 5 },
      cargo: { m: 0, c: 0, d: 0 },
      fuel: 0,
      aim: 'gauss',
    };
    store.saveFleet(missiles);
    expect(store.fleet('f4')).toEqual(missiles);
    const plain: Fleet = { ...missiles, id: 'f5' };
    delete plain.aim;
    store.saveFleet(plain);
    expect(store.fleet('f5')).toEqual(plain);
    store.deleteFleet('f4');
    expect(
      db
        .prepare(
          "SELECT key, count FROM fleet_ships WHERE fleet_id IN ('f4', 'f5')",
        )
        .all(),
    ).toEqual([{ key: 'ipm', count: 5 }]);
    expect(() =>
      db.exec("UPDATE fleets SET mission = 'nope' WHERE id = 'f5'"),
    ).toThrow('CHECK');
    expect(() => db.exec("UPDATE fleets SET gift = 2 WHERE id = 'f5'")).toThrow(
      'CHECK',
    );
    db.close();
  });
});
