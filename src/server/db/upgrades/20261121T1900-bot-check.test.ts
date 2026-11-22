// Upgrade test of migration 20261121T1900-bot-check (#181): a new, empty
// table of the switched-on checks; every existing player starts with the
// check off, and everything else stays. A row goes with its account and
// refuses an unknown one.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/181/migrations.ts';

const ID = '20261121T1900-bot-check';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

function running(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000);
    INSERT INTO settings (key, value) VALUES ('round', 3);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty table and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = running();
    const old = ['users', 'settings'].map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(['users', 'settings'].map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'bot_checks')).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('drops the row with the account and refuses an unknown account', () => {
    const db = running();
    migrate(db, through);
    db.prepare('INSERT INTO bot_checks (player, since) VALUES (?, ?)').run(
      'u_Anna',
      1763700000000,
    );
    expect(() =>
      db
        .prepare('INSERT INTO bot_checks (player, since) VALUES (?, ?)')
        .run('u_Nobody', 1),
    ).toThrow();
    db.prepare('DELETE FROM users WHERE id = ?').run('u_Anna');
    expect(all(db, 'bot_checks')).toEqual([]);
    db.close();
  });
});
