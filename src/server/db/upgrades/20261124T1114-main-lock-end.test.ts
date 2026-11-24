// Upgrade test of migration 20261124T1114-main-lock-end (#366): the end of
// the lock of the main planet is stored at the switch (owner, 2026-11-22),
// so a change of the setting during the round counts only for later
// switches. Every lock that exists at the upgrade gets the end it has by
// the rule before: the time of the switch plus the days the round has then,
// 7 without a setting [V]; a player without a switch has no end; everything
// else stays.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/366/migrations.ts';

const ID = '20261124T1114-main-lock-end';
const through = migrationsThrough(ID);
const DAY = 86_400_000;

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** Anna switched her main planet at 1763300000000, Bert never; the round sets <days> or nothing. */
function round(days: number | null): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, probes, read_at, main_planet, main_switched) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 3, 0, 'p2_5_9', 1763300000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, 1, 0, NULL, NULL);
    INSERT INTO settings (key, value) VALUES ('round', 2);
  `);
  if (days !== null)
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('roundMainLock', ?)",
    ).run(days);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('gives a switch the end it has by the rule before, with the days of the round', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = round(3);
    const settings = all(db, 'settings');
    const users = all(db, 'users');
    expect(migrate(db, through)).toBe(1);
    expect(all(db, 'settings')).toEqual(settings);
    expect(all(db, 'users')).toEqual(
      users.map((u) => ({
        ...u,
        main_lock_end: u.id === 'u_Anna' ? 1763300000000 + 3 * DAY : null,
      })),
    );
    db.close();
  });

  it('takes the 7 days of the default without a setting of the round', () => {
    const db = round(null);
    migrate(db, through);
    const anna = db
      .prepare("SELECT main_lock_end AS end FROM users WHERE id = 'u_Anna'")
      .get() as { end: number };
    expect(anna.end).toBe(1763300000000 + 7 * DAY);
    db.close();
  });
});
