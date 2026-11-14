import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 16 rebuilds fleets and fleet_ships for the mission Bergung (#45).
describe('upgrade to migration 16', () => {
  it('keeps fleets in flight with their ships, fuel and recall', () => {
    const db = databaseAt(15);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 1);
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel)
      VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
          'deploy', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41),
        ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'attack', 0, 0, 0, 4, 5, 6, 'back', 1, 7);
      INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f1', 'lf', 1), ('f2', 'lf', 3);
    `);
    const before = db
      .prepare('SELECT * FROM fleets ORDER BY id')
      .all() as unknown[];
    expect(migrate(db, MIGRATIONS.slice(0, 16))).toBe(1);
    expect(db.prepare('SELECT * FROM fleets ORDER BY id').all()).toEqual(
      before,
    );
    const store = new Store(db);
    expect(store.fleet('f1')).toMatchObject({
      mission: 'deploy',
      ships: { sc: 2, lf: 1 },
      cargo: { m: 100.5, c: 20, d: 3 },
      fuel: 41,
      recalled: false,
    });
    expect(store.fleet('f2')).toMatchObject({
      mission: 'attack',
      ships: { lf: 3 },
      state: 'back',
      recalled: true,
      fuel: 7,
    });
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'old_%'")
        .all(),
    ).toEqual([]);
    // The new mission is accepted and flies to a Trümmerfeld; ships still
    // go with their fleet.
    const harvest = {
      ...store.fleet('f1')!,
      id: 'f3',
      to: 'd1_1_6',
      mission: 'harvest' as const,
      ships: { recycler: 2 },
    };
    store.saveFleet(harvest);
    expect(store.fleet('f3')).toEqual(harvest);
    store.deleteFleet('f1');
    expect(
      db
        .prepare('SELECT fleet_id, key FROM fleet_ships ORDER BY fleet_id, key')
        .all(),
    ).toEqual([
      { fleet_id: 'f2', key: 'lf' },
      { fleet_id: 'f3', key: 'recycler' },
    ]);
    expect(() =>
      db.exec("UPDATE fleets SET mission = 'nope' WHERE id = 'f3'"),
    ).toThrow('CHECK');
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'fleets' AND sql IS NOT NULL",
        )
        .all(),
    ).toEqual([{ name: 'fleets_owner' }]);
    db.close();
  });
});
