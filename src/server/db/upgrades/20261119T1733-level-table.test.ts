// Upgrade test of migration 20261119T1733-level-table (#187): the option
// „Stufenübersicht“ of a player. Every existing player gets the ▤ icon (D5),
// everything else stays, and only the three modes are accepted.
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVEL_MODE } from '../../../core/level-overview.ts';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/187/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261119T1733-level-table';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: two players, one with research and a hidden „?“. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, email, salt, pw_hash, admin, probes, explain_mode, read_at, created)
      VALUES ('u_Anna', 'Anna', 'anna@example.org', 's', 'h', 1, 7, 'icon', 5, 1),
             ('u_Bert', 'Bert', NULL, 't', 'i', 0, 1, 'hidden', 0, 2);
    INSERT INTO user_research VALUES ('u_Bert', 'energy', 2);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimat', 1, 2, 3, 40, 900, 100, 50, 10, 1, 'planet');
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('gives every player the ▤ icon and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['user_research', 'planets'];
    const old = tables.map((t) => all(db, t));
    const users = all(db, 'users');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'users')).toEqual(
      users.map((u) => ({ ...u, level_table: DEFAULT_LEVEL_MODE })),
    );
    db.close();
  });

  it('is read by the store for every player', () => {
    const db = runningRound();
    migrate(db, through);
    const store = new Store(db);
    expect(store.user('u_Anna')).toMatchObject({ levelTable: 'icon' });
    expect(store.user('u_Bert')).toMatchObject({
      levelTable: 'icon',
      explain: 'hidden',
    });
    db.close();
  });

  it('accepts only the three modes', () => {
    const db = runningRound();
    migrate(db, through);
    const add = (id: string, mode: string) =>
      db
        .prepare(
          `INSERT INTO users (id, name, salt, pw_hash, created, level_table)
           VALUES (?, ?, 's', 'h', 1, ?)`,
        )
        .run(id, id, mode);
    for (const mode of ['always', 'icon', 'hidden']) add(mode, mode);
    expect(() => add('bad', 'never')).toThrow(/CHECK constraint failed/);
    expect(() =>
      db.exec(
        `INSERT INTO users (id, name, salt, pw_hash, created, level_table)
         VALUES ('null', 'null', 's', 'h', 1, NULL)`,
      ),
    ).toThrow(/NOT NULL constraint failed/);
    db.close();
  });
});
