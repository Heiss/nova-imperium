// Upgrade test of migration 20261119T1830-last-targets (#292): the table of
// the last hostile targets starts empty, every other row stays, and a
// player's rows go with the player.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/292/migrations.ts';

const ID = '20261119T1830-last-targets';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: two players with a planet each. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1), ('u_Bert', 'Bert', 's', 'h', 2);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimat', 1, 2, 3, 40, 900, 100, 50, 10, 1, 'planet'),
      ('p1_4_5', 'u_Bert', 'Heimat', 1, 4, 5, 40, 900, 100, 50, 10, 1, 'planet');
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty table and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets'];
    const old = tables.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'last_targets')).toEqual([]);
    db.close();
  });

  it('keeps one row per player and place, and deletes the rows with the player', () => {
    const db = runningRound();
    migrate(db, through);
    const add = (user: string, place: string, owner: string, at: number) =>
      db
        .prepare('INSERT INTO last_targets VALUES (?, ?, ?, ?)')
        .run(user, place, owner, at);
    add('u_Anna', 'p1_4_5', 'u_Bert', 5);
    expect(() => add('u_Anna', 'p1_4_5', 'u_Bert', 6)).toThrow(/UNIQUE/);
    // Another player may aim at the same place.
    add('u_Bert', 'p1_4_5', 'u_Bert', 7);
    expect(() => add('u_Nobody', 'p1_4_5', 'u_Bert', 8)).toThrow(/FOREIGN KEY/);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(all(db, 'last_targets').map((r) => r.user_id)).toEqual(['u_Bert']);
    db.close();
  });
});
