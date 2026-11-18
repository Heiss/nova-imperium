// Upgrade test of migration 20261117T1158-jump-gate (#230): the new, empty
// table of the gate times. Every Warp-Tor of a running round starts ready,
// every other table keeps its rows, and a gate time goes with its moon.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/230/migrations.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';
import { createCtx } from '../../game/context.ts';

const ID = '20261117T1158-jump-gate';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: Anna with her home planet and two moons, one with a Warp-Tor. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('m1_2_3', 'u_Anna', 'Mond', 1, 2, 3, 40, 0, 0, 0, 1763300000000, 1763295000000, 'moon'),
      ('m2_5_9', 'u_Anna', 'Mond', 2, 5, 9, -10, 0, 0, 0, 1763300000000, 1763296000000, 'moon');
    INSERT INTO planet_buildings VALUES
      ('m1_2_3', 'moonbase', 1), ('m1_2_3', 'jumpgate', 1), ('p1_2_3', 'metal', 4);
    INSERT INTO planet_units VALUES ('m1_2_3', 'ship', 'lc', 7);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'planet_buildings', 'planet_units'];

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty table of gate times and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'jump_gates')).toEqual([]);
    db.close();
  });

  it('starts every gate ready; a stored time goes with its moon', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const ctx = createCtx(new Store(db), { now: () => 1763300000000 });
    expect(ctx.planets.gateReady('m1_2_3')).toBe(0);
    ctx.planets.setGateReady('m1_2_3', 1763303600000);
    expect(ctx.planets.gateReady('m1_2_3')).toBe(1763303600000);
    // Only a moon of the planets can hold a gate time.
    expect(() => ctx.planets.setGateReady('m9_9_9', 1)).toThrow(
      'FOREIGN KEY constraint failed',
    );
    db.prepare("DELETE FROM planets WHERE id = 'm1_2_3'").run();
    expect(all(db, 'jump_gates')).toEqual([]);
    db.close();
  });
});
