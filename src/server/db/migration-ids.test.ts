// Migrations with fixed IDs (#213): the order of the IDs, the record of run
// migrations in schema_migrations, the start of that record from the
// user_version of a database written before #213, and repeated runs.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  describeSchema,
  migrationsThrough,
  plansBefore,
  populate,
  snapshot,
} from '../../test/migrations.ts';
import {
  migrate,
  openDatabase,
  pendingMigrations,
  type Db,
} from './database.ts';
import { MIGRATIONS, type Migration } from './schema.ts';

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-ids-'));
  file = path.join(dir, 'nova.sqlite');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/**
 * A database as the server before #213 wrote it: the SQL of the first n
 * migrations, each followed by its user_version, and no record of IDs.
 */
function legacyDatabase(
  target: string,
  n: number,
  migrations: readonly Migration[] = MIGRATIONS,
): Db {
  const db = new Database(target);
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    for (let v = 0; v < n; v++) {
      db.exec(migrations[v]!.sql);
      db.pragma(`user_version = ${v + 1}`);
    }
  })();
  return db;
}

const hasRecord = (db: Db): boolean =>
  db
    .prepare(
      "SELECT count(*) FROM sqlite_master WHERE name = 'schema_migrations'",
    )
    .pluck()
    .get() === 1;

/** The recorded IDs in the order SQLite stored them. */
const recorded = (db: Db): string[] =>
  db
    .prepare('SELECT id FROM schema_migrations ORDER BY rowid')
    .pluck()
    .all() as string[];

const version = (db: Db): number =>
  db.pragma('user_version', { simple: true }) as number;

const backups = (): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.bak'))
    .sort();

const ids = (list: readonly Migration[]): string[] => list.map((m) => m.id);

const a = { id: '20261101T0800-a', sql: 'CREATE TABLE t (x INTEGER);' };
const b = { id: '20261102T0900-b', sql: 'ALTER TABLE t ADD COLUMN y INTEGER;' };
const c = { id: '20261103T1000-c', sql: 'UPDATE t SET y = x * 2;' };
const insert = {
  id: '20261101T0900-insert',
  sql: 'INSERT INTO t (x) VALUES (1), (2);',
};

describe('the released migrations', () => {
  // The IDs of the migrations released before #213, from the UTC commit
  // time of the commit on main that added each one. They never change.
  it('keep the IDs they got from the history of main', () => {
    expect(ids(MIGRATIONS.slice(0, 20))).toEqual([
      '20261106T2104-first-schema',
      '20261107T0911-account-tokens',
      '20261107T0924-guilds',
      '20261107T0945-push',
      '20261107T1403-achievements',
      '20261107T1417-admin-audit',
      '20261107T1556-announcement-text',
      '20261107T1556-passkeys',
      '20261108T1207-colonization',
      '20261112T1613-explanation-texts',
      '20261112T1652-research-planet',
      '20261112T2219-error-log',
      '20261113T0006-deploy-mission',
      '20261113T1126-planet-fields',
      '20261113T2315-places',
      '20261114T1315-harvest-mission',
      '20261114T1638-push-kinds',
      '20261114T1809-gift-fleet',
      '20261114T1856-guild-ranks',
      '20261115T0952-guild-chat',
    ]);
  });
});

describe('upgrade tests', () => {
  it('name a migration by its ID, not by its place', () => {
    expect(migrationsThrough('20261107T1556-passkeys')).toEqual(
      MIGRATIONS.slice(0, 8),
    );
    expect(migrationsThrough(b.id, [a, b, c])).toEqual([a, b]);
    expect(migrationsThrough(a.id, [a, b, c])).toEqual([a]);
    expect(() => migrationsThrough('20261107T1556-nope')).toThrow(
      'No migration 20261107T1556-nope.',
    );
  });
});

describe('a new database', () => {
  it('runs every migration in the order of the IDs and records each', () => {
    const db = openDatabase(':memory:');
    expect(recorded(db)).toEqual(ids(MIGRATIONS));
    expect(version(db)).toBe(MIGRATIONS.length);
    db.close();
  });

  it('records no migration for an empty list and makes no backup', () => {
    const db = openDatabase(file, []);
    expect(hasRecord(db)).toBe(true);
    expect(recorded(db)).toEqual([]);
    expect(version(db)).toBe(0);
    db.close();
    expect(backups()).toEqual([]);
  });

  it('returns the migrations still to run', () => {
    const db = new Database(':memory:');
    expect(pendingMigrations(db, [a, b])).toEqual([a, b]);
    migrate(db, [a]);
    expect(pendingMigrations(db, [a, b, c])).toEqual([b, c]);
    expect(pendingMigrations(db, [a])).toEqual([]);
    db.close();
  });
});

describe('repeated runs', () => {
  it('run nothing twice, change nothing and make no backup', () => {
    openDatabase(file, [a, insert]).close();
    const db = openDatabase(file, [a, insert]);
    expect(migrate(db, [a, insert])).toBe(0);
    expect(db.prepare('SELECT count(*) FROM t').pluck().get()).toBe(2);
    expect(recorded(db)).toEqual([a.id, insert.id]);
    expect(version(db)).toBe(2);
    db.close();
    expect(backups()).toEqual([]);
  });

  it('run only the new migrations and back up before them', () => {
    openDatabase(file, [a, insert]).close();
    const db = openDatabase(file, [a, insert, b]);
    expect(recorded(db)).toEqual([a.id, insert.id, b.id]);
    expect(version(db)).toBe(3);
    expect(db.prepare('SELECT count(*) FROM t').pluck().get()).toBe(2);
    db.close();
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
  });
});

describe('a database from before #213', () => {
  it.each([0, 1, 7, 8, 19, 20])(
    'at user_version %i has run the first migrations and runs the rest',
    (n) => {
      legacyDatabase(file, n).close();
      // A migration that ran again would fail: its tables exist already.
      const db = openDatabase(file);
      expect(recorded(db)).toEqual(ids(MIGRATIONS));
      expect(version(db)).toBe(MIGRATIONS.length);
      db.close();
      expect(backups()).toEqual(n === 0 ? [] : [`nova.sqlite.v${n}.bak`]);
    },
  );

  it('runs the migrations above its user_version only', () => {
    legacyDatabase(file, 2, [a, insert]).close();
    const db = openDatabase(file, [a, insert, b, c]);
    expect(db.prepare('SELECT x, y FROM t ORDER BY x').all()).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ]);
    expect(recorded(db)).toEqual([a.id, insert.id, b.id, c.id]);
    db.close();
  });

  it('is refused when it is newer than the server, and stays as it was', () => {
    legacyDatabase(file, 2, [a, insert]).close();
    expect(() => openDatabase(file, [a])).toThrow(
      'The database has schema version 2, this server knows 1. Use the newer image or restore a backup.',
    );
    const db = new Database(file);
    expect(hasRecord(db)).toBe(false);
    expect(version(db)).toBe(2);
    db.close();
    expect(backups()).toEqual([]);
  });

  it('keeps no record when a migration fails', () => {
    legacyDatabase(file, 1, [a]).close();
    const bad = { id: '20261102T0000-bad', sql: 'INSERT INTO nope VALUES (1)' };
    expect(() => openDatabase(file, [a, bad])).toThrow(/no such table: nope/);
    const db = new Database(file);
    expect(hasRecord(db)).toBe(false);
    expect(version(db)).toBe(1);
    db.close();
  });

  // A real database of version 20, written as the released server wrote
  // it, with generated data of every table: the new server only starts the
  // record, keeps every row and leaves a backup of version 20.
  it('of version 20 with data keeps everything and records the 20 IDs', () => {
    for (const plan of fc.sample(plansBefore(21), { numRuns: 5, seed: 213 })) {
      rmSync(dir, { recursive: true, force: true });
      dir = mkdtempSync(path.join(tmpdir(), 'nova-ids-'));
      file = path.join(dir, 'nova.sqlite');
      const old = legacyDatabase(file, 20);
      populate(old, describeSchema(old), plan);
      const before = snapshot(old);
      old.close();

      const db = openDatabase(file, MIGRATIONS.slice(0, 20));
      const after = snapshot(db);
      expect(after.data).toEqual(before.data);
      for (const [name, sql] of before.schema)
        expect(after.schema.get(name), name).toBe(sql);
      expect([...after.schema.keys()].toSorted()).toEqual(
        [...before.schema.keys(), 'schema_migrations'].toSorted(),
      );
      expect(recorded(db)).toEqual(ids(MIGRATIONS.slice(0, 20)));
      expect(version(db)).toBe(20);
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(db.pragma('foreign_key_check')).toEqual([]);
      db.close();

      const bak = path.join(dir, 'nova.sqlite.v20.bak');
      expect(existsSync(bak)).toBe(true);
      const copy = new Database(bak, { readonly: true });
      expect(snapshot(copy)).toEqual(before);
      expect(hasRecord(copy)).toBe(false);
      copy.close();
    }
  });
});

describe('the order of the IDs', () => {
  it('refuses a list out of order before it changes anything', () => {
    const db = new Database(':memory:');
    expect(() => migrate(db, [b, a])).toThrow(
      `Migration ${a.id} does not sort after ${b.id}.`,
    );
    expect(() => migrate(db, [a, { ...b, id: 'b' }])).toThrow(
      /^Migration 2: "b" is no migration ID/,
    );
    expect(hasRecord(db)).toBe(false);
    expect(version(db)).toBe(0);
    db.close();
  });

  // D3: two migrations on the same table run in the order of their IDs on
  // every database, whichever of them a database had run already.
  it('gives the same schema and data on a new and on an upgraded database', () => {
    const fresh = new Database(':memory:');
    migrate(fresh, [a, insert, b, c]);
    for (const start of [1, 2, 3]) {
      const db = new Database(':memory:');
      migrate(db, [a, insert, b, c].slice(0, start));
      migrate(db, [a, insert, b, c]);
      expect(snapshot(db)).toEqual(snapshot(fresh));
      expect(recorded(db)).toEqual(recorded(fresh));
      db.close();
    }
    fresh.close();
  });

  // The strict variant of D3 [V]: a migration older than one the database
  // has run would run out of order there, so the server refuses to start.
  it('refuses a migration older than one the database has run', () => {
    openDatabase(file, [a, b]).close();
    expect(() => openDatabase(file, [a, insert, b])).toThrow(
      `Migration ${insert.id} is older than migration ${b.id}, which the database has run already; it would run out of order. A new migration needs an ID after every released one.`,
    );
    const db = new Database(file);
    expect(recorded(db)).toEqual([a.id, b.id]);
    expect(version(db)).toBe(2);
    db.close();
    expect(backups()).toEqual([]);
  });

  it('refuses a database that ran a migration this server does not know', () => {
    const unknown = (ran: Migration): string =>
      `The database has run migration ${ran.id}, which this server does not know. Use the newer image or restore a backup.`;
    const db = new Database(':memory:');
    migrate(db, [a, b, c]);
    expect(() => migrate(db, [a, b])).toThrow(unknown(c));
    expect(() => migrate(db, [a, c])).toThrow(unknown(b));
    const other = { ...c, id: '20261102T0800-other' };
    expect(() => migrate(db, [a, other, b, c])).toThrow(
      `Migration ${other.id} is older than migration ${b.id}`,
    );
    expect(recorded(db)).toEqual([a.id, b.id, c.id]);
    db.close();
  });
});
