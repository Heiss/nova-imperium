// Upgrade test of migration 20261120T0900-round-archive (#235): the new
// tables of the archive and the row of the round that runs at the migration.
// A running round gets its row with the coverage „partial“ and the start it
// has, a universe without a planet starts „complete“; every other table keeps
// its rows; a deleted account is cut from the archive under its pseudonym.
import { describe, expect, it } from 'vitest';
import { databaseAt, migrationsThrough } from '../../../test/migrations.ts';
import { DELETED_PLAYER } from '../../../core/round-report.ts';
import { migrate, type Db } from '../database.ts';
import migrations from '../migrations/235/migrations.ts';

const ID = '20261120T0900-round-archive';
const through = migrationsThrough(ID);
const before = (): Db => databaseAt(through.length - 1);

type Rows = Record<string, unknown>[];
const all = (db: Db, table: string): Rows =>
  db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all() as Rows;

/** Round 3 as players left it: two accounts with planets, a stored start. */
function runningRound(): Db {
  const db = before();
  db.exec(`
    INSERT INTO users (id, name, salt, pw_hash, created) VALUES
      ('u_Anna', 'Anna', 's', 'h', 1700000000000),
      ('u_Bert', 'Bert', 's', 'h', 1700000500000);
    INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
      ('p_a', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 900, 100, 50, 1763300000000, 1763251200000, 'planet'),
      ('p_b', 'u_Bert', 'Heimatplanet', 1, 4, 7, 20, 500, 300, 0, 1763300000000, 1763251300000, 'planet');
    INSERT OR REPLACE INTO settings (key, value) VALUES ('round', 3), ('roundStart', 1763251100000);
  `);
  return db;
}

const TABLES = ['users', 'planets', 'settings'];

describe(`upgrade to migration ${ID}`, () => {
  it('is the newest migration of #235', () => {
    expect(migrations.map((m) => m.id)).toContain(ID);
  });

  it('gives the running round its row: partial coverage, its number and start, no stored rules', () => {
    const db = runningRound();
    const old = TABLES.map((t) => all(db, t));
    expect(migrate(db, through)).toBe(1);
    expect(TABLES.map((t) => all(db, t))).toEqual(old);
    expect(all(db, 'rounds')).toEqual([
      {
        number: 3,
        status: 'active',
        started: 1763251100000,
        closed: null,
        coverage: 'partial',
        rules: '{}',
        events: null,
      },
    ]);
    expect(all(db, 'round_participants')).toEqual([]);
    expect(all(db, 'round_events')).toEqual([]);
    db.close();
  });

  it('dates a running round without a stored start by its first planet, a round without a setting is round 1', () => {
    const db = before();
    db.exec(`
      INSERT INTO users (id, name, salt, pw_hash, created) VALUES ('u_Anna', 'Anna', 's', 'h', 1);
      INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t, created, kind) VALUES
        ('p_a', 'u_Anna', 'Heimatplanet', 1, 2, 3, 40, 0, 0, 0, 1, 1763251200000, 'planet');
    `);
    db.exec('DELETE FROM settings');
    migrate(db, through);
    expect(all(db, 'rounds')).toMatchObject([
      { number: 1, started: 1763251200000, coverage: 'partial' },
    ]);
    db.close();
  });

  it('starts a universe without a planet with a complete round 1 dated now', () => {
    const db = before();
    db.exec('DELETE FROM settings');
    const at = Date.now();
    migrate(db, through);
    const [round] = all(db, 'rounds') as {
      started: number;
      coverage: string;
    }[];
    expect(round!.coverage).toBe('complete');
    expect(Math.abs(round!.started - at)).toBeLessThan(60_000);
    db.close();
  });

  it('cuts a deleted account from the archive and keeps its numbers', () => {
    const db = runningRound();
    migrate(db, through);
    db.exec(`
      INSERT INTO round_participants (round, seat, player, name) VALUES
        (3, 1, 'u_Anna', 'Anna'), (3, 2, 'u_Bert', 'Bert');
      INSERT INTO round_events (round, at, recorded, kind, seat, version, payload) VALUES
        (3, 5, 5, 'player.final', 1, 1, '{"valuation":{"total":7}}');
      DELETE FROM users WHERE id = 'u_Anna';
    `);
    expect(all(db, 'round_participants')).toEqual([
      { round: 3, seat: 1, player: null, name: DELETED_PLAYER },
      { round: 3, seat: 2, player: 'u_Bert', name: 'Bert' },
    ]);
    expect(all(db, 'round_events')).toHaveLength(1);
    db.close();
  });

  it('deletes the participants and events with their round', () => {
    const db = runningRound();
    migrate(db, through);
    db.exec(`
      INSERT INTO round_participants (round, seat, player, name) VALUES (3, 1, 'u_Anna', 'Anna');
      INSERT INTO round_events (round, at, recorded, kind, seat, version, payload) VALUES
        (3, 5, 5, 'round.started', NULL, 1, '{}');
      DELETE FROM rounds WHERE number = 3;
    `);
    expect(all(db, 'round_participants')).toEqual([]);
    expect(all(db, 'round_events')).toEqual([]);
    db.close();
  });

  it('refuses an event of a round that does not exist and an unknown status', () => {
    const db = runningRound();
    migrate(db, through);
    expect(() =>
      db
        .prepare(
          "INSERT INTO round_events (round, at, recorded, kind, version, payload) VALUES (9, 1, 1, 'x', 1, '{}')",
        )
        .run(),
    ).toThrow('FOREIGN KEY constraint failed');
    expect(() =>
      db.prepare("UPDATE rounds SET status = 'paused'").run(),
    ).toThrow('CHECK constraint failed');
    db.close();
  });
});
