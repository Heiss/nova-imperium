// Upgrade test of migration 20261118T2324-marketplace (#171): the two new,
// empty tables of the marketplace. A running round has made no exchange yet,
// so every pair is at its base price and every player has given nothing
// today; the other data stay as they were, and what a player gave goes with
// the player.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/171/migrations.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';
import { createCtx } from '../../game/context.ts';

const ID = '20261118T2324-marketplace';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** A running round: Anna with her home planet and a Servitorenschmiede. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet');
    INSERT INTO planet_buildings VALUES ('p1_2_3', 'robot', 4);
    INSERT INTO settings (key, value) VALUES ('round', 2);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'planet_buildings', 'settings'];

describe(`upgrade to migration ${ID}`, () => {
  it('adds two empty tables and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'market_prices')).toEqual([]);
    expect(all(db, 'market_usage')).toEqual([]);
    db.close();
  });

  it('puts every pair at its base price and every player at 0 given today', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const ctx = createCtx(new Store(db), { now: () => 1763300000000 });
    expect(ctx.market.prices()).toEqual({});
    expect(ctx.market.used('u_Anna', 20408)).toBe(0);
    ctx.market.savePrice('cd', { price: 800000, at: 1763300000000 });
    ctx.market.addUsed('u_Anna', 20408, 1200);
    expect(all(db, 'market_prices')).toEqual([
      { pair: 'cd', price: 800000, changed: 1763300000000 },
    ]);
    expect(all(db, 'market_usage')).toEqual([
      { user_id: 'u_Anna', day: 20408, amount: 1200 },
    ]);
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(all(db, 'market_usage')).toEqual([]);
    db.close();
  });
});
