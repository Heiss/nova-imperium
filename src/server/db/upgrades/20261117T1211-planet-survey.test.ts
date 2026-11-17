// Upgrade test of migration 20261117T1211-planet-survey (#190): fleets and
// reports are rebuilt so that they allow the mission Vermessung and its
// reports; every fleet, ship and report keeps its values, and the table of
// the surveyed positions starts empty.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/190/migrations.ts';

const ID = '20261117T1211-planet-survey';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round with fleets in flight, ships and reports of every type. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2);
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_6', 1, 1, 6,
        'deploy', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 1),
      ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'd1_2_6', 1, 2, 6,
        'harvest', 0, 0, 0, 4, 5, 6, 'back', 1, 7, 0),
      ('f3', 'u_Bert', 'p1_4_7', 1, 4, 7, 'p1_1_5', 1, 1, 5,
        'spy', 0, 0, 0, 7, 8, 9, 'out', 0, 1, 0);
    INSERT INTO fleet_ships VALUES ('f1', 'sc', 2), ('f2', 'recycler', 3),
      ('f3', 'probe', 4);
    INSERT INTO reports (id, user_id, time, seq, type, title, body) VALUES
      ('r1', 'u_Anna', 10, 1, 'info', 'Kolonie gegründet [1:2:3]', '{"text":"x"}'),
      ('r2', 'u_Anna', 11, 2, 'battle', 'Kampfbericht', '{"rounds":2}'),
      ('r3', 'u_Bert', 12, 1, 'spy', 'Auspex-Bericht', '{"lost":false}');
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('keeps every fleet, ship and report and adds an empty table of surveys', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['fleets', 'fleet_ships', 'reports', 'users'];
    const old = tables.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'surveys')).toEqual([]);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    // The ships still belong to their fleet: deleting it deletes them.
    db.prepare("DELETE FROM fleets WHERE id = 'f3'").run();
    expect(all(db, 'fleet_ships').map((r) => r.fleet_id)).toEqual(['f1', 'f2']);
    db.close();
  });

  it('allows the Vermessung and its reports, and nothing else new', () => {
    const db = runningRound();
    migrate(db, through);
    db.exec(`
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state)
      VALUES ('f4', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_9', 1, 1, 9,
        'survey', 0, 0, 0, 1, 2, 3, 'out');
      INSERT INTO reports (id, user_id, time, seq, type, title, body)
      VALUES ('r4', 'u_Anna', 13, 3, 'survey', 'Vermessungsbericht [1:1:9]', '{}');
      INSERT INTO surveys (id, g, s, p, temp, diameter, created)
      VALUES ('v1', 1, 1, 9, 52, 14600, 20);
    `);
    expect(all(db, 'fleets').find((r) => r.id === 'f4')).toMatchObject({
      mission: 'survey',
      gift: 0,
    });
    expect(() =>
      db.exec(
        "UPDATE fleets SET mission = 'expedition' WHERE id = 'f4'",
      ),
    ).toThrow(/CHECK/);
    expect(() =>
      db.exec("UPDATE reports SET type = 'other' WHERE id = 'r4'"),
    ).toThrow(/CHECK/);
    expect(() =>
      db.exec(
        "INSERT INTO surveys (id, g, s, p, temp, diameter, created) VALUES ('v2', 1, 1, 9, 1, 1, 1)",
      ),
    ).toThrow(/UNIQUE/);
    db.close();
  });
});
