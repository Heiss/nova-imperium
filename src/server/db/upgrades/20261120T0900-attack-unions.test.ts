// Upgrade test of migration 20261120T0900-attack-unions (#225): the column
// `fleets.union_id` and the table of the invitations. No fleet changes (the
// column is added, `fleets` is not rebuilt): every fleet in flight keeps its
// values, its ships, its gift, its holding time and its main target, and has
// no union; the invitations start empty and go with a deleted account.
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../../core/types.ts';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/225/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261120T0900-attack-unions';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: a gift, an attack, a fleet that holds and missiles with a main target. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet'),
      ('p1_2_6', 'u_Bert', 'Beta', 1, 2, 6, 20, 500, 300, 0, 10, 2, 'planet');
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift, hold, aim)
    VALUES ('f1', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
        'attack', 100.5, 20, 3, 1, 2, 3, 'out', 0, 41, 0, 0, NULL),
      ('f2', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_1_5', 1, 1, 5,
        'deploy', 0, 0, 0, 4, 5, 6, 'out', 0, 0, 1, 0, NULL),
      ('f3', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_1_5', 1, 1, 5,
        'hold', 0, 0, 0, 7, 8, 9, 'hold', 0, 7, 0, 3600000, NULL),
      ('f4', 'u_Bert', 'p1_2_6', 1, 2, 6, 'p1_1_5', 1, 1, 5,
        'missile', 0, 0, 0, 7, 8, 9, 'out', 0, 0, 0, 0, 'gauss');
    INSERT INTO fleet_ships VALUES ('f1', 'lf', 2), ('f1', 'sc', 1),
      ('f2', 'lc', 42), ('f3', 'bs', 3), ('f4', 'ipm', 5);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds the column and the table, changes no fleet and no other table', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets', 'fleet_ships'];
    const old = tables.map((t) => all(db, t));
    const fleets = all(db, 'fleets');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'fleets')).toEqual(fleets.map((f) => ({ ...f, union_id: null })));
    expect(all(db, 'attack_union_invites')).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    // No rebuild: no leftover table, the index of the owner stays.
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
    db.close();
  });

  it('reads every fleet as before: no union, the gift, the holding time and the main target kept', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    for (const id of ['f1', 'f2', 'f3', 'f4'])
      expect(store.fleet(id)).not.toHaveProperty('union');
    expect(store.fleet('f2')).toMatchObject({ gift: true, ships: { lc: 42 } });
    expect(store.fleet('f3')).toMatchObject({ hold: 3600000, state: 'hold' });
    expect(store.fleet('f4')).toMatchObject({ aim: 'gauss' });
    db.close();
  });

  it('stores a fleet of a union and takes it out again; a fleet of no union stays NULL', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    // The column is written when a fleet is saved first; a later save of the
    // same fleet leaves it (a union changes through its own calls).
    const lead: Fleet = { ...store.fleet('f1')!, id: 'f6', union: 'f6' };
    store.saveFleet(lead);
    expect(store.fleet('f6')).toEqual(lead);
    expect(
      db.prepare("SELECT union_id FROM fleets WHERE id = 'f2'").pluck().get(),
    ).toBeNull();
    expect(
      db.prepare('SELECT id FROM fleets WHERE union_id = ?').pluck().all('f6'),
    ).toEqual(['f6']);
    db.prepare('UPDATE fleets SET union_id = NULL WHERE id = ?').run('f6');
    expect(store.fleet('f6')).not.toHaveProperty('union');
    db.close();
  });

  it('keeps one invitation per union and player, and forgets a deleted account', () => {
    const db = runningRound();
    migrate(db, through);
    const add = db.prepare(
      'INSERT INTO attack_union_invites (union_id, user_id) VALUES (?, ?)',
    );
    add.run('f1', 'u_Bert');
    expect(() => add.run('f1', 'u_Bert')).toThrow();
    add.run('f1', 'u_Anna');
    add.run('f9', 'u_Bert');
    expect(() => add.run('f1', 'u_Nobody')).toThrow();
    db.prepare('DELETE FROM users WHERE id = ?').run('u_Bert');
    expect(all(db, 'attack_union_invites')).toEqual([
      { union_id: 'f1', user_id: 'u_Anna' },
    ]);
    db.close();
  });
});
