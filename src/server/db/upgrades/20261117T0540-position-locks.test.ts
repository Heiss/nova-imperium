// Upgrade test of migration 20261117T0540-position-locks (#224): the locks
// of given-up positions. A running round has given up no colony yet, so the
// new table starts empty and every free position stays colonizable; the
// other data stay as they were.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/224/migrations.ts';
import { Store } from '../store.ts';
import { MIGRATIONS } from '../schema.ts';
import { createCtx } from '../../game/context.ts';

const ID = '20261117T0540-position-locks';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna with her home planet, a colony and a moon, Bert with a fleet to the colony. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, main_planet, main_switched) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 'p2_5_9', 1763290000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, NULL, NULL);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p2_5_9', 'u_Anna', 'Kolonie', 2, 5, 9, -10, 10, 0, 0, 1763300000000, 1763290000000, 'planet'),
      ('m2_5_9', 'u_Anna', 'Mond', 2, 5, 9, -10, 0, 0, 0, 1763300000000, 1763295000000, 'moon'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet');
    INSERT INTO planet_buildings VALUES ('p2_5_9', 'metal', 4);
    INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet, to_g, to_s, to_p,
      mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state) VALUES
      ('f1', 'u_Bert', 'p1_4_7', 1, 4, 7, 'p2_5_9', 2, 5, 9, 'spy', 0, 0, 0, 1, 2, 3, 'out');
    INSERT INTO settings (key, value) VALUES ('round', 2), ('roundMainLock', 7);
  `);
  return db;
}

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty table of locks and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const tables = [
      'users',
      'planets',
      'planet_buildings',
      'fleets',
      'settings',
    ];
    const old = tables.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(tables.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'position_locks')).toEqual([]);
    db.close();
  });

  it('locks no position; the store locks a position and a new round forgets it', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const ctx = createCtx(new Store(db), { now: () => 1763300000000 });
    for (const at of [
      { g: 1, s: 2, p: 3 },
      { g: 2, s: 5, p: 9 },
      { g: 3, s: 1, p: 1 },
    ])
      expect(ctx.planets.positionLock(at)).toBeNull();
    ctx.planets.lockPosition({ g: 3, s: 1, p: 1 }, 1763386400000);
    expect(all(db, 'position_locks')).toEqual([
      { g: 3, s: 1, p: 1, until: 1763386400000 },
    ]);
    expect(ctx.planets.positionLock({ g: 3, s: 1, p: 1 })).toBe(1763386400000);
    ctx.planets.deleteAll();
    expect(all(db, 'position_locks')).toEqual([]);
    db.close();
  });
});
