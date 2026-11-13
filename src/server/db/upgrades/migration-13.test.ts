import { describe, expect, it } from 'vitest';
import { databaseAt } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

// Migration 13 rebuilds fleets and fleet_ships for the deploy mission and
// adds the fuel a fleet burnt (#129).
describe('upgrade to migration 13', () => {
  it('keeps fleets in flight with their ships; they burnt no recorded fuel', () => {
    const db = databaseAt(12);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 1);
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled)
      VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
          'transport', 100, 20, 3, 1, 2, 3, 'out', 0),
        ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'colonize', 0, 0, 0, 4, 5, 6, 'back', 1);
      INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f1', 'lf', 1), ('f2', 'colony', 1);
    `);
    expect(migrate(db, MIGRATIONS.slice(0, 13))).toBe(1);
    const store = new Store(db);
    expect(store.fleets()).toEqual([
      {
        id: 'f1',
        owner: 'u_Anna',
        from: 'p1_1_5',
        fromC: { g: 1, s: 1, p: 5 },
        to: 'p1_1_6',
        toC: { g: 1, s: 1, p: 6 },
        mission: 'transport',
        ships: { sc: 2, lf: 1 },
        cargo: { m: 100, c: 20, d: 3 },
        dep: 1,
        arr: 2,
        ret: 3,
        state: 'out',
        recalled: false,
        fuel: 0,
      },
      {
        id: 'f2',
        owner: 'u_Anna',
        from: 'p1_1_5',
        fromC: { g: 1, s: 1, p: 5 },
        to: 'p1_2_6',
        toC: { g: 1, s: 2, p: 6 },
        mission: 'colonize',
        ships: { colony: 1 },
        cargo: { m: 0, c: 0, d: 0 },
        dep: 4,
        arr: 5,
        ret: 6,
        state: 'back',
        recalled: true,
        fuel: 0,
      },
    ]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(
      db
        .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'old_%'")
        .all(),
    ).toEqual([]);
    // The new mission is accepted, its fuel kept; ships still go with their fleet.
    const deploy = {
      ...store.fleet('f1')!,
      id: 'f3',
      mission: 'deploy' as const,
      fuel: 41,
    };
    store.saveFleet(deploy);
    expect(store.fleet('f3')).toEqual(deploy);
    store.deleteFleet('f1');
    expect(
      db
        .prepare('SELECT fleet_id, key FROM fleet_ships ORDER BY fleet_id, key')
        .all(),
    ).toEqual([
      { fleet_id: 'f2', key: 'colony' },
      { fleet_id: 'f3', key: 'lf' },
      { fleet_id: 'f3', key: 'sc' },
    ]);
    expect(() =>
      db.exec("UPDATE fleets SET mission = 'nope' WHERE id = 'f3'"),
    ).toThrow('CHECK');
    db.close();
  });
});
