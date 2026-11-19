// Upgrade test of migration 20261119T0744-holding (#55): the rebuild of
// fleets and fleet_ships for the mission Halten. Every fleet in flight keeps
// its ships, cargo, times, recall, fuel and gift and holds for no time; the
// new mission, the state 'hold' and a holding time are accepted.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { type Db, migrate } from '../database.ts';
import migrations from '../migrations/55/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261119T0744-holding';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** Fleets of every mission in flight: out, back, recalled, a gift. */
function running(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2);
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
        'deploy', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 0),
      ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
        'attack', 0, 0, 0, 4, 5, 6, 'back', 1, 7, 0),
      ('f3', 'u_Bert', 'p1_2_6', 1, 2, 6, 'd1_1_6', 1, 1, 6,
        'harvest', 0, 0, 0, 7, 8, 9, 'out', 0, 2, 0),
      ('f4', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_2_6', 1, 2, 6,
        'deploy', 5, 5, 5, 10, 11, 11, 'out', 0, 0, 1);
    INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f1', 'lf', 1), ('f2', 'lf', 3),
      ('f3', 'recycler', 4), ('f4', 'bs', 9);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('keeps every fleet in flight with its ships, and none of them holds', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = running();
    const fleets = all(db, 'fleets');
    const ships = all(db, 'fleet_ships');
    expect(migrate(db, through)).toBe(1);
    expect(all(db, 'fleets')).toEqual(fleets.map((f) => ({ ...f, hold: 0 })));
    expect(all(db, 'fleet_ships')).toEqual(ships);
    const store = new Store(db);
    expect(store.fleet('f1')).toMatchObject({
      mission: 'deploy',
      ships: { sc: 2, lf: 1 },
      cargo: { m: 100.5, c: 20, d: 3 },
      fuel: 41,
      state: 'out',
      recalled: false,
    });
    expect(store.fleet('f2')).toMatchObject({ state: 'back', recalled: true });
    expect(store.fleet('f4')).toMatchObject({ gift: true, ships: { bs: 9 } });
    for (const id of ['f1', 'f2', 'f3', 'f4'])
      expect(store.fleet(id), id).not.toHaveProperty('hold');
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
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
  });

  it('accepts a Halten that holds, and its ships go with it', () => {
    const db = running();
    migrate(db, through);
    const store = new Store(db);
    const hold = {
      ...store.fleet('f1')!,
      id: 'f5',
      to: 'p1_2_6',
      toC: { g: 1, s: 2, p: 6 },
      mission: 'hold' as const,
      ships: { cr: 2 },
      state: 'hold' as const,
      hold: 7_200_000,
    };
    store.saveFleet(hold);
    expect(store.fleet('f5')).toEqual(hold);
    store.deleteFleet('f5');
    expect(
      db.prepare("SELECT key FROM fleet_ships WHERE fleet_id = 'f5'").all(),
    ).toEqual([]);
    for (const sql of [
      "UPDATE fleets SET mission = 'nope' WHERE id = 'f1'",
      "UPDATE fleets SET state = 'gone' WHERE id = 'f1'",
      "UPDATE fleets SET hold = -1 WHERE id = 'f1'",
      "UPDATE fleets SET gift = 2 WHERE id = 'f1'",
    ])
      expect(() => db.exec(sql), sql).toThrow('CHECK');
  });

  it('deletes the fleets with their owner, as before', () => {
    const db = running();
    migrate(db, through);
    db.exec("DELETE FROM users WHERE id = 'u_Bert'");
    expect(all(db, 'fleets').map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(all(db, 'fleet_ships').map((r) => r.fleet_id)).toEqual([
      'f1',
      'f1',
      'f2',
    ]);
  });
});
