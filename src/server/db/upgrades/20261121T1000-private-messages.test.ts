// Upgrade test of migration 20261121T1000-private-messages (#226): the new,
// empty tables of the private messages, the reports, the block list and the
// switch „only friends“. Every existing player starts without messages and
// blocks; everything else stays. The tables refuse a text of the wrong
// length and a message to oneself; a deleted account cuts its side of a
// message and the other player keeps the conversation (owner, 2026-11-21).
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/226/migrations.ts';
import { MIGRATIONS } from '../schema.ts';
import { Store } from '../store.ts';

const ID = '20261121T1000-private-messages';
const through = migrationsThrough(ID);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all() as Rows;

/** A running round: Anna, Bert and Cora with their home planets. */
function runningRound(): Db {
  const db = databaseAt(through.length - 1);
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000),
      ('u_Cora', 'Cora', 's', 'h', 1700000900000);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p1_2_3', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p1_4_7', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251200000, 'planet');
    INSERT INTO settings (key, value) VALUES ('round', 3);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'settings'];
const NEW_TABLES = [
  'private_messages',
  'message_reports',
  'message_blocks',
  'message_options',
];

describe(`upgrade to migration ${ID}`, () => {
  it('adds empty tables and keeps the data', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    for (const table of NEW_TABLES) expect(all(db, table)).toEqual([]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    db.close();
  });

  it('refuses a message of the wrong length, to oneself and to an unknown account', () => {
    const db = runningRound();
    migrate(db, through);
    const add = db.prepare(
      'INSERT INTO private_messages (sender, recipient, time, text) VALUES (?, ?, 1, ?)',
    );
    add.run('u_Anna', 'u_Bert', 'a');
    add.run('u_Anna', 'u_Bert', 'a'.repeat(1000));
    expect(() => add.run('u_Anna', 'u_Bert', '')).toThrow();
    expect(() => add.run('u_Anna', 'u_Bert', 'a'.repeat(1001))).toThrow();
    expect(() => add.run('u_Anna', 'u_Anna', 'Hallo')).toThrow();
    expect(() => add.run('u_Anna', 'u_Nobody', 'Hallo')).toThrow();
    expect(all(db, 'private_messages')).toHaveLength(2);
    expect(all(db, 'private_messages')[0]).toMatchObject({
      read: 0,
      hidden_sender: 0,
      hidden_recipient: 0,
    });
    db.close();
  });

  it('keeps the conversation for the other player when an account is deleted', () => {
    const db = runningRound();
    migrate(db, through);
    db.exec(`
      INSERT INTO private_messages (sender, recipient, time, text) VALUES
        ('u_Anna', 'u_Bert', 1, 'Hallo'), ('u_Bert', 'u_Anna', 2, 'Hi');
    `);
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(all(db, 'private_messages')).toMatchObject([
      { sender: null, recipient: 'u_Bert', text: 'Hallo' },
      { sender: 'u_Bert', recipient: null, text: 'Hi' },
    ]);
    // With the other account gone too, nobody can see them: they go.
    db.prepare("DELETE FROM users WHERE id = 'u_Bert'").run();
    expect(all(db, 'private_messages')).toEqual([]);
    db.close();
  });

  it('stores one report per message, and the report outlives the message and the account', () => {
    const db = runningRound();
    migrate(db, through);
    const add = db.prepare(
      'INSERT INTO message_reports (message, sender, recipient, sent, reported, text) VALUES (?, ?, ?, 1, 2, ?)',
    );
    add.run(7, 'u_Anna', 'u_Bert', 'Hallo');
    expect(() => add.run(7, 'u_Anna', 'u_Bert', 'Hallo')).toThrow();
    expect(() => add.run(8, 'u_Anna', 'u_Bert', '')).toThrow();
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(all(db, 'message_reports')).toMatchObject([
      { message: 7, sender: null, recipient: 'u_Bert', text: 'Hallo' },
    ]);
    db.close();
  });

  it('keeps one block per pair, never of oneself, and forgets a deleted account', () => {
    const db = runningRound();
    migrate(db, through);
    const block = db.prepare(
      'INSERT INTO message_blocks (blocker, blocked) VALUES (?, ?)',
    );
    block.run('u_Anna', 'u_Bert');
    block.run('u_Bert', 'u_Anna');
    expect(() => block.run('u_Anna', 'u_Bert')).toThrow();
    expect(() => block.run('u_Cora', 'u_Cora')).toThrow();
    db.prepare(
      "INSERT INTO message_options (user_id, friends_only) VALUES ('u_Anna', 1)",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO message_options (user_id, friends_only) VALUES ('u_Bert', 2)",
        )
        .run(),
    ).toThrow();
    db.prepare("DELETE FROM users WHERE id = 'u_Bert'").run();
    expect(all(db, 'message_blocks')).toEqual([]);
    db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(all(db, 'message_options')).toEqual([]);
    db.close();
  });

  it('lets the store of today read and write them after all migrations', () => {
    const db = runningRound();
    migrate(db, through);
    migrate(db, MIGRATIONS);
    const { repos } = new Store(db);
    expect(repos.privateMessages.visibleTo('u_Anna')).toEqual([]);
    const id = repos.privateMessages.add('u_Anna', 'u_Bert', 5, 'Hallo');
    expect(repos.privateMessages.visibleTo('u_Bert')).toMatchObject([
      { id, sender: 'u_Anna', text: 'Hallo', read: false },
    ]);
    expect(repos.players.get('u_Anna')).toMatchObject({ name: 'Anna' });
    db.close();
  });
});
