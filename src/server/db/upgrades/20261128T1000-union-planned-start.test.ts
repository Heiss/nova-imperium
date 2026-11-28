// Upgrade test of migration 20261128T1000-union-planned-start (#478): the
// union row gets the planned start of its leader's fleet. A union of a
// running round has its leading fleet out already, so its start stays empty
// and it reads as before; no other table changes. A new union can carry a
// planned start, which the repository reads back and lists when it is due
// and by its planet.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/478/migrations.ts';
import type { Union } from '../repos/unions.ts';
import { Store } from '../store.ts';

const ID = '20261128T1000-union-planned-start';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: Anna's union f1 to Cora, its leading fleet out. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Cora', 'Cora', 's', 'h', 3);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet'),
      ('p1_3_7', 'u_Cora', 'Gamma', 1, 3, 7, 20, 500, 300, 0, 10, 3, 'planet');
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift, hold, aim, union_id)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_3_7', 1, 3, 7,
        'attack', 0, 0, 0, 100, 5000, 9900, 'out', 0, 41, 0, 0, NULL, 'f1');
    INSERT INTO fleet_ships VALUES ('f1', 'lf', 2);
    INSERT INTO attack_unions (id, leader, lead, target, to_g, to_s, to_p, arr)
      VALUES ('f1', 'u_Anna', 'f1', 'p1_3_7', 1, 3, 7, 5000);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('keeps every row, a union in flight without a planned start', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets', 'fleets', 'fleet_ships'];
    const old = tables.map((t) => all(db, t));
    const union = all(db, 'attack_unions');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'attack_unions')).toEqual([
      {
        ...union[0],
        start_at: null,
        start_from: null,
        start_ships: null,
        start_pct: null,
      },
    ]);
    const unions = new Store(db).repos.unions;
    expect(unions.get('f1')).not.toHaveProperty('start');
    expect(unions.dueStarts(Number.MAX_SAFE_INTEGER)).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('keeps the planned start of a new union, lists it when due and by its planet, and clears it at the start', () => {
    const db = runningRound();
    migrate(db, through);
    const unions = new Store(db).repos.unions;
    const start = { at: 7000, from: 'p1_1_5', ships: { lf: 3, sc: 1 }, pct: 4 };
    const u9: Union = {
      id: 'u9',
      leader: 'u_Anna',
      lead: 'u9',
      target: 'p1_3_7',
      toC: { g: 1, s: 3, p: 7 },
      arr: 20000,
      start,
    };
    unions.save(u9);
    expect(unions.get('u9')).toEqual(u9);
    expect(unions.dueStarts(6999)).toEqual([]);
    expect(unions.dueStarts(7000)).toEqual([u9]);
    expect(unions.startsFrom('p1_1_5')).toEqual([u9]);
    expect(unions.startsFrom('p1_3_7')).toEqual([]);
    const started = { ...u9 };
    delete started.start;
    unions.save(started);
    expect(unions.get('u9')).toEqual(started);
    expect(unions.dueStarts(Number.MAX_SAFE_INTEGER)).toEqual([]);
    expect(unions.startsFrom('p1_1_5')).toEqual([]);
    db.close();
  });
});
