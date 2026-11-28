// Upgrade test of migration 20261128T1300-score-pass (#491): the table of the
// newest highscore pass. A running round has none stored: the table starts
// empty and no other table changes; the repository then keeps one row at
// most, replaced by each new pass.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/491/migrations.ts';
import { Store } from '../store.ts';

const ID = '20261128T1300-score-pass';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna with her planet. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_1_5', 'u_Anna', 'Heimat', 1, 1, 5, 40, 900, 100, 50, 10, 1, 'planet');
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds the empty table and keeps every other row', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = ['users', 'planets'].map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(['users', 'planets'].map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'score_pass')).toEqual([]);
    expect(new Store(db).repos.scorePasses.get()).toBeNull();
    db.close();
  });

  it('keeps one pass at most, the newest, as it was written', () => {
    const db = runningRound();
    migrate(db, through);
    const passes = new Store(db).repos.scorePasses;
    const pass = {
      total: { u_Anna: 12 },
      categories: {
        u_Anna: {
          economy: { count: 3, points: 12 },
          military: { count: 0, points: 0 },
        },
      },
    };
    passes.save({ round: '100/0', at: 5000, pass });
    expect(passes.get()).toEqual({ round: '100/0', at: 5000, pass });
    passes.save({
      round: '100/1',
      at: 6000,
      pass: { total: {}, categories: {} },
    });
    expect(passes.get()).toEqual({
      round: '100/1',
      at: 6000,
      pass: { total: {}, categories: {} },
    });
    expect(all(db, 'score_pass')).toHaveLength(1);
    expect(() =>
      db.exec(
        `INSERT INTO score_pass (id, round, at, pass) VALUES (2, 'x', 1, '{}')`,
      ),
    ).toThrow(/CHECK constraint failed/);
    db.close();
  });
});
