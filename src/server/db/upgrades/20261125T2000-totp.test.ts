// Upgrade test of migration 20261125T2000-totp (#401): the table of the
// authenticator apps comes empty, every account and every other table stays,
// and an app goes with its account.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import migrations from '../migrations/401/migrations.ts';

const ID = '20261125T2000-totp';
const through = migrationsThrough(ID);

describe(`upgrade to migration ${ID}`, () => {
  it('adds the empty table of the apps and keeps the accounts', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = databaseAt(through.length - 1);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at) VALUES
        ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 0),
        ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0);
    `);
    const users = db.prepare('SELECT * FROM users ORDER BY id').all();
    expect(migrate(db, through)).toBe(1);
    expect(db.prepare('SELECT * FROM users ORDER BY id').all()).toEqual(users);
    expect(db.prepare('SELECT * FROM totp').all()).toEqual([]);
    db.prepare(
      "INSERT INTO totp (user_id, secret, created) VALUES ('u_Anna', 'S', 1)",
    ).run();
    expect(
      db.prepare('SELECT confirmed, last_step, attempts FROM totp').get(),
    ).toEqual({ confirmed: 0, last_step: null, attempts: 0 });
    expect(() =>
      db
        .prepare(
          "INSERT INTO totp (user_id, secret, created, confirmed) VALUES ('u_Bert', 'S', 1, 2)",
        )
        .run(),
    ).toThrow();
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(db.prepare('SELECT * FROM totp').all()).toEqual([]);
    db.close();
  });
});
