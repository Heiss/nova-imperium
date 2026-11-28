// Upgrade test of migration 20261127T1800-hold-refusals (#440): the table of
// „Keine Wachen annehmen“ comes empty, so every player takes holds as before
// (default off); the holds in every state, the accounts and the planets stay
// as they were, and a refusal goes with its account.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate } from '../database.ts';
import migrations from '../migrations/440/migrations.ts';

const ID = '20261127T1800-hold-refusals';
const through = migrationsThrough(ID);

describe(`upgrade to migration ${ID}`, () => {
  it('adds the empty table of the refusals and keeps the holds in every state', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = databaseAt(through.length - 1);
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at) VALUES
        ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 0),
        ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0);
      INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
        ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet'),
        ('p1_2_6', 'u_Bert', 'Beta', 1, 2, 6, 20, 500, 300, 0, 10, 2, 'planet');
      INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
        mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled, fuel, gift, hold, aim)
      VALUES
        ('f_out', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'hold', 10, 0, 0, 1, 2, 3, 'out', 0, 5, 0, 3600000, NULL),
        ('f_hold', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'hold', 0, 20, 0, 1, 2, 3, 'hold', 0, 5, 0, 7200000, NULL),
        ('f_back', 'u_Anna', 'p1_1_5', 1, 1, 5, 'p1_2_6', 1, 2, 6,
          'hold', 0, 0, 30, 1, 2, 3, 'back', 1, 5, 0, 0, NULL);
    `);
    const tables = ['users', 'planets', 'fleets'].map((t) =>
      db.prepare(`SELECT * FROM ${t} ORDER BY id`).all(),
    );
    expect(migrate(db, through)).toBe(1);
    expect(
      ['users', 'planets', 'fleets'].map((t) =>
        db.prepare(`SELECT * FROM ${t} ORDER BY id`).all(),
      ),
    ).toEqual(tables);
    expect(db.prepare('SELECT * FROM hold_refusals').all()).toEqual([]);
    db.prepare("INSERT INTO hold_refusals (user_id) VALUES ('u_Bert')").run();
    // Once per player, and only for an account that exists.
    expect(() =>
      db.prepare("INSERT INTO hold_refusals (user_id) VALUES ('u_Bert')").run(),
    ).toThrow();
    expect(() =>
      db
        .prepare("INSERT INTO hold_refusals (user_id) VALUES ('u_Nobody')")
        .run(),
    ).toThrow();
    db.prepare("DELETE FROM users WHERE id = 'u_Bert'").run();
    expect(db.prepare('SELECT * FROM hold_refusals').all()).toEqual([]);
    db.close();
  });
});
