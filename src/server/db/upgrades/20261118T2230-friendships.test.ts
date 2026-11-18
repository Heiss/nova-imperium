// Upgrade test of migration 20261118T2230-friendships (#227): the new,
// empty table of the buddy list. Every existing player starts without
// friends and requests; everything else stays. The table keeps one row per
// pair, never a player with themselves, and forgets a deleted account.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/227/migrations.ts';
import { Store } from '../store.ts';
import { MIGRATIONS } from '../schema.ts';

const ID = '20261118T2230-friendships';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna, Bert and Cora with their home planets, Anna and Bert in a guild. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created, main_planet, main_switched) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000, 'p1_2_3', 1763290000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000, NULL, NULL),
      ('u_Cora', 'Cora', 's', 'h', 1700000900000, NULL, NULL);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet'),
      ('p2_1_9', 'u_Cora', 'Heimatplanet', 2, 1, 9, 10, 500, 300, 0, 1763300000000, 1763251200000, 'planet');
    INSERT INTO guilds (id, tag, name, description, founder) VALUES ('g1', 'ABC', 'Alpha', '', 'u_Anna');
    INSERT INTO settings (key, value) VALUES ('round', 3), ('roundMainLock', 7);
    INSERT INTO player_activity VALUES ('u_Bert', 1763251200000, 1763299000000, 60000);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'guilds', 'settings', 'player_activity'];

describe(`upgrade to migration ${ID}`, () => {
  it('adds an empty buddy list and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'friendships')).toEqual([]);
    db.close();
  });

  it('keeps one row per pair, never with oneself, and only between players', () => {
    const db = runningRound();
    migrate(db, through);
    const add = db.prepare(
      'INSERT INTO friendships (requester, addressee, status) VALUES (?, ?, ?)',
    );
    add.run('u_Anna', 'u_Bert', 'pending');
    expect(() => add.run('u_Anna', 'u_Bert', 'pending')).toThrow();
    expect(() => add.run('u_Bert', 'u_Anna', 'friend')).toThrow();
    expect(() => add.run('u_Cora', 'u_Cora', 'pending')).toThrow();
    expect(() => add.run('u_Cora', 'u_Nobody', 'pending')).toThrow();
    expect(() => add.run('u_Cora', 'u_Anna', 'blocked')).toThrow();
    add.run('u_Cora', 'u_Anna', 'friend');
    expect(all(db, 'friendships')).toEqual([
      { requester: 'u_Anna', addressee: 'u_Bert', status: 'pending' },
      { requester: 'u_Cora', addressee: 'u_Anna', status: 'friend' },
    ]);
    // Deleting an account deletes its rows, as requester and as addressee.
    db.prepare("DELETE FROM users WHERE id = 'u_Cora'").run();
    expect(all(db, 'friendships')).toEqual([
      { requester: 'u_Anna', addressee: 'u_Bert', status: 'pending' },
    ]);
    db.prepare("DELETE FROM users WHERE id = 'u_Bert'").run();
    expect(all(db, 'friendships')).toEqual([]);
    db.close();
  });

  it('lets the store of today read and write the list after all migrations', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const { repos } = new Store(db);
    expect(repos.friends.links('u_Anna')).toEqual([]);
    repos.friends.request('u_Bert', 'u_Cora');
    repos.friends.accept('u_Bert', 'u_Cora');
    expect(repos.friends.links('u_Cora')).toEqual([
      { from: 'u_Bert', to: 'u_Cora', status: 'friend' },
    ]);
    expect(repos.players.get('u_Anna')).toMatchObject({
      name: 'Anna',
      mainPlanet: 'p1_2_3',
    });
    db.close();
  });
});
