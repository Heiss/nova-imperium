// Upgrade test of migration 20261119T0810-moonbreak (#95): the migration runs on
// data of the version before it and keeps or changes them as intended.
// It rebuilds fleets and fleet_ships so that the CHECK of fleets.mission
// allows the mission Mondbruch; every fleet keeps every column, the gift of
// the „Endzeit“ (#161) included, and its ships.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import migrations from '../migrations/95/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261119T0810-moonbreak';

const rows = (db: ReturnType<typeof databaseAt>, sql: string): unknown[] =>
  db.prepare(sql).all();

describe(`upgrade to migration ${ID}`, () => {
  it('keeps the data of the version before', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const through = migrationsThrough(ID);
    const db = databaseAt(through.length - 1);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES
        ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 1);
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift)
      VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'm1_1_6', 1, 1, 6,
          'deploy', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 0),
        ('f2', 'u_Anna', 'm1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'attack', 0, 0, 0, 4, 5, 6, 'back', 1, 7, 0),
        ('f3', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_2_6', 1, 2, 6,
          'deploy', 1, 2, 3, 7, 8, 8, 'out', 0, 0, 1),
        ('f4', 'u_Bert', 'p1_2_6', 1, 2, 6, 'd1_1_5', 1, 1, 5,
          'harvest', 0, 0, 0, 9, 10, 11, 'out', 0, 5, 0);
      INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f1', 'lf', 1),
        ('f2', 'lf', 3), ('f3', 'bs', 4), ('f4', 'recycler', 2);
    `);
    const before = rows(db, 'SELECT * FROM fleets ORDER BY id');
    const ships = rows(db, 'SELECT * FROM fleet_ships ORDER BY fleet_id, key');
    expect(migrate(db, through)).toBe(1);
    expect(rows(db, 'SELECT * FROM fleets ORDER BY id')).toEqual(before);
    expect(
      rows(db, 'SELECT * FROM fleet_ships ORDER BY fleet_id, key'),
    ).toEqual(ships);
    const store = new Store(db);
    expect(store.fleet('f1')).toMatchObject({
      mission: 'deploy',
      to: 'm1_1_6',
      ships: { sc: 2, lf: 1 },
      cargo: { m: 100.5, c: 20, d: 3 },
      fuel: 41,
      recalled: false,
    });
    expect(store.fleet('f1')).not.toHaveProperty('gift');
    expect(store.fleet('f2')).toMatchObject({
      from: 'm1_1_5',
      state: 'back',
      recalled: true,
    });
    expect(store.fleet('f3')).toMatchObject({
      gift: true,
      ships: { bs: 4 },
    });
    expect(store.fleet('f4')).toMatchObject({ mission: 'harvest' });
    // A gift still takes no fleet slot (#161).
    expect(store.repos.fleets.count('u_Bert')).toBe(1);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(
      rows(db, "SELECT name FROM sqlite_master WHERE name LIKE 'old_%'"),
    ).toEqual([]);
    expect(
      rows(
        db,
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'fleets' AND sql IS NOT NULL",
      ),
    ).toEqual([{ name: 'fleets_owner' }]);

    // A Mondbruch flies to a moon and is saved with its ships.
    const moonbreak = {
      ...store.fleet('f1')!,
      id: 'f5',
      to: 'm1_2_6',
      toC: { g: 1, s: 2, p: 6 },
      mission: 'moonbreak' as const,
      ships: { dstar: 2, bs: 1 },
    };
    store.saveFleet(moonbreak);
    expect(store.fleet('f5')).toEqual(moonbreak);
    expect(() =>
      db.exec("UPDATE fleets SET mission = 'nope' WHERE id = 'f5'"),
    ).toThrow('CHECK');
    expect(() => db.exec("UPDATE fleets SET gift = 2 WHERE id = 'f5'")).toThrow(
      'CHECK',
    );

    // The cascades: a fleet takes its ships, a player his fleets.
    store.deleteFleet('f1');
    db.prepare("DELETE FROM users WHERE id = 'u_Bert'").run();
    expect(
      rows(db, 'SELECT fleet_id, key FROM fleet_ships ORDER BY fleet_id, key'),
    ).toEqual([
      { fleet_id: 'f2', key: 'lf' },
      { fleet_id: 'f5', key: 'bs' },
      { fleet_id: 'f5', key: 'dstar' },
    ]);
    expect(rows(db, 'SELECT id FROM fleets ORDER BY id')).toEqual([
      { id: 'f2' },
      { id: 'f5' },
    ]);
    db.close();
  });
});
