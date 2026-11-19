// Upgrade test of migration 20261119T1700-expeditions (#93): fleets and
// fleet_ships are rebuilt for the mission Expedition. It runs after the
// rebuilds of Halten, the Mondbruch, the survey and the missiles, so every
// fleet in flight keeps its values, its gift, its holding time, its main
// target and its ships; the other tables stay; the new mission can be
// stored, an unknown one still not. The CHECK lists exactly the missions
// and the states of the code and every column stays.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/93/migrations.ts';
import { Store } from '../store.ts';
import { MISSION } from '../../../core/missions.ts';

const ID = '20261119T1700-expeditions';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: a fleet in flight, the gift of the „Endzeit“, a Halten that holds and missiles with a main target. */
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
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift, hold, aim)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
        'attack', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 0, 0, NULL),
      ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_5', 1, 1, 5,
        'deploy', 0, 0, 0, 4, 5, 6, 'out', 0, 0, 1, 0, NULL),
      ('f3', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_1_5', 1, 1, 5,
        'missile', 0, 0, 0, 7, 8, 8, 'out', 0, 0, 0, 0, 'gauss'),
      ('f5', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_1_5', 1, 1, 5,
        'hold', 0, 0, 0, 9, 10, 20, 'hold', 0, 4, 0, 3600000, NULL);
    INSERT INTO fleet_ships VALUES ('f1', 'lf', 2), ('f1', 'sc', 1),
      ('f2', 'lc', 42), ('f3', 'ipm', 5), ('f5', 'lc', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('keeps every fleet with its ships, gift, holding time and main target, and the other tables', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets', 'planet_units', 'fleet_ships'];
    const old = tables.map((t) => all(db, t));
    const fleets = all(db, 'fleets');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'fleets')).toEqual(fleets);
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
    expect(store.fleet('f3')).toMatchObject({
      aim: 'gauss',
      ships: { ipm: 5 },
    });
    // A Halten that holds keeps its state and its holding time (#55).
    expect(store.fleet('f5')).toMatchObject({
      mission: 'hold',
      state: 'hold',
      hold: 3_600_000,
      ships: { lc: 3 },
    });
    db.close();
  });

  it('allows every mission of the game, exactly those, and keeps the columns (#55, #95, #190, #54, #93)', () => {
    const db = runningRound();
    migrate(db, through);
    const columns = db
      .prepare("SELECT name FROM pragma_table_info('fleets')")
      .pluck()
      .all();
    expect(columns).toEqual(
      expect.arrayContaining(['gift', 'aim', 'fuel', 'hold']),
    );
    const ids = Object.keys(MISSION);
    expect(ids).toContain('expedition');
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
    // The CHECK lists exactly the missions of the code.
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
    // The states: out, hold (a Halten, #55) and back; an expedition stays out.
    const states = /state IN \(([^)]*)\)/
      .exec(sql)![1]!
      .split(',')
      .map((x) => x.trim().replaceAll("'", ''));
    expect(states).toEqual(['out', 'hold', 'back']);
    db.close();
  });

  it('stores an expedition with its ships and refuses an unknown mission', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    const expedition = {
      ...store.fleet('f1')!,
      id: 'f4',
      mission: 'expedition' as const,
      ships: { lc: 5, probe: 1 },
      cargo: { m: 0, c: 0, d: 0 },
      fuel: 12,
      toC: { g: 1, s: 2, p: 16 },
      to: 'p1_2_16',
    };
    store.saveFleet(expedition);
    expect(store.fleet('f4')).toEqual(expedition);
    expect(() =>
      db.exec("UPDATE fleets SET mission = 'nope' WHERE id = 'f4'"),
    ).toThrow('CHECK');
    expect(() => db.exec("UPDATE fleets SET gift = 2 WHERE id = 'f4'")).toThrow(
      'CHECK',
    );
    db.close();
  });
});
