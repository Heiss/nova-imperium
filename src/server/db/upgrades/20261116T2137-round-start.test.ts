// Upgrade test of migration 20261116T2137-round-start (#220): the start of
// the round for the day of the round of the daily reward. A running round
// starts at the creation of its first planet, a universe without a planet
// at the time of the migration ([V]); everything else stays.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/220/migrations.ts';

const ID = '20261116T2137-round-start';
const through = migrationsThrough(ID);
const before = (): Db => databaseAt(through.length - 1);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

const roundStart = (db: Db): unknown =>
  (
    db.prepare("SELECT value FROM settings WHERE key = 'roundStart'").get() as
      { value: number } | undefined
  )?.value;

/** Round 2 as players left it: Anna's home planet, her colony and moon, Bert's home planet. */
function runningRound(): Db {
  const db = before();
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p_b', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet'),
      ('p_a', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p_c', 'u_Anna', 'Kolonie', 2, 5, 9, -10, 10, 0, 0, 1763300000000, 1763290000000, 'planet'),
      ('m_a', 'u_Anna', 'Mond', 1, 2, 3, 40, 0, 0, 0, 1763300000000, 1763295000000, 'moon');
    INSERT INTO settings (key, value) VALUES
      ('round', 2), ('roundDaily', 1), ('roundAchievements', 0), ('speed', 3);
    INSERT INTO daily_rewards (user_id, last_day, streak, claimed_day) VALUES
      ('u_Anna', 20408, 4, 20408);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('starts a running round at the creation of its first planet and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = ['users', 'planets', 'daily_rewards'];
    const old = tables.map((t) => all(db, t));
    const settings = all(db, 'settings');
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(roundStart(db)).toBe(1763251200000);
    expect(all(db, 'settings')).toEqual(
      [...settings, { key: 'roundStart', value: 1763251200000 }].sort((a, b) =>
        String(a.key).localeCompare(String(b.key), 'en'),
      ),
    );
  });

  it('starts a universe without a planet at the time of the migration', () => {
    const db = before();
    db.exec(
      "INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 5)",
    );
    const from = Math.floor(Date.now() / 1000) * 1000;
    expect(migrate(db, through)).toBe(1);
    const to = Date.now();
    const start = roundStart(db) as number;
    expect(Number.isInteger(start)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(from);
    expect(start).toBeLessThanOrEqual(to);
  });

  it('keeps a stored start of the round', () => {
    const db = runningRound();
    db.exec("INSERT INTO settings (key, value) VALUES ('roundStart', 42)");
    expect(migrate(db, through)).toBe(1);
    expect(roundStart(db)).toBe(42);
  });
});
