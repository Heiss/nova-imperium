import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  describeSchema,
  plansBefore,
  populate,
  snapshot,
} from '../../test/migrations.ts';
import { BACKUPS_KEPT, openDatabase, verifyBackup } from './database.ts';
import { MIGRATIONS } from './schema.ts';

const STEPS = [
  'CREATE TABLE a (x INTEGER)',
  'INSERT INTO a VALUES (1)',
  'INSERT INTO a VALUES (2)',
  'INSERT INTO a VALUES (3)',
  'INSERT INTO a VALUES (4)',
  'INSERT INTO a VALUES (5)',
];

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-db-'));
  file = path.join(dir, 'nova.sqlite');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const backups = (): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.bak'))
    .sort();

const rows = (f: string): number[] => {
  const db = new Database(f, { readonly: true });
  const r = db.prepare('SELECT x FROM a ORDER BY x').pluck().all() as number[];
  db.close();
  return r;
};

const version = (f: string): number => {
  const db = new Database(f, { readonly: true });
  const v = db.pragma('user_version', { simple: true }) as number;
  db.close();
  return v;
};

describe('backup before migrations', () => {
  it('makes no backup of a new database', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    expect(backups()).toEqual([]);
  });

  it('copies the database with its old schema version before migrating', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
    const bak = path.join(dir, 'nova.sqlite.v2.bak');
    expect(version(bak)).toBe(2);
    expect(rows(bak)).toEqual([1]);
    expect(rows(file)).toEqual([1, 2]);
  });

  it('makes no backup when nothing is to migrate', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 2)).close();
    expect(backups()).toEqual([]);
  });

  it(`keeps only the newest ${BACKUPS_KEPT} backups`, () => {
    expect(BACKUPS_KEPT).toBe(3);
    for (let n = 1; n <= STEPS.length; n++)
      openDatabase(file, STEPS.slice(0, n)).close();
    expect(backups()).toEqual([
      'nova.sqlite.v3.bak',
      'nova.sqlite.v4.bak',
      'nova.sqlite.v5.bak',
    ]);
  });

  it('replaces a backup of the same version', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    const db = new Database(file);
    db.pragma('user_version = 2');
    db.close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
    expect(rows(path.join(dir, 'nova.sqlite.v2.bak'))).toEqual([1, 2]);
  });

  it('counts versions with more digits and ignores look-alike files', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    const decoys = [
      'nova.sqlite.v0.old',
      'nova.sqlite.vx12.bak',
      'nova.sqlite.v12x.bak',
      'nova.sqlite.v.bak',
      'xnova.sqlite.v0.bak',
    ];
    for (const f of [
      ...decoys,
      'nova.sqlite.v1.bak',
      'nova.sqlite.v10.bak',
      'nova.sqlite.v11.bak',
    ])
      writeFileSync(path.join(dir, f), '');
    openDatabase(file, STEPS.slice(0, 3)).close();
    const left = readdirSync(dir);
    for (const f of decoys) expect(left, f).toContain(f);
    expect(backups()).toEqual(
      [
        'nova.sqlite.v10.bak',
        'nova.sqlite.v11.bak',
        'nova.sqlite.v2.bak',
        ...decoys.filter((f) => f.endsWith('.bak')),
      ].sort(),
    );
  });

  it('leaves other files alone', () => {
    openDatabase(path.join(dir, 'other.sqlite'), STEPS.slice(0, 1)).close();
    openDatabase(path.join(dir, 'other.sqlite'), STEPS.slice(0, 2)).close();
    for (let n = 1; n <= 5; n++) openDatabase(file, STEPS.slice(0, n)).close();
    expect(backups()).toContain('other.sqlite.v1.bak');
  });

  it('names the backup when a migration fails and changes nothing', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    let error: Error | undefined;
    try {
      openDatabase(file, [...STEPS.slice(0, 2), 'INSERT INTO nope VALUES (1)']);
    } catch (e) {
      error = e as Error;
    }
    const bak = path.join(dir, 'nova.sqlite.v2.bak');
    expect(error?.message).toContain('Migration from schema version 2 failed');
    expect(error?.message).toContain(bak);
    expect(error?.message).toContain('no such table: nope');
    expect(error?.message).toContain('changed nothing');
    expect(error?.message).toContain(`copy it over ${file}`);
    expect(error?.message).toContain(`delete ${file}-wal and ${file}-shm`);
    expect(error?.cause).toBeInstanceOf(Error);
    expect(existsSync(bak)).toBe(true);
    expect(version(file)).toBe(2);
    expect(rows(file)).toEqual([1]);
  });

  it('keeps the plain error for a database without backup', () => {
    expect(() =>
      openDatabase(':memory:', ['INSERT INTO nope VALUES (1)']),
    ).toThrow(/^no such table: nope$/);
  });
});

describe('fail closed', () => {
  const unchanged = (): void => {
    expect(version(file)).toBe(2);
    expect(rows(file)).toEqual([1]);
  };

  it('does not migrate when the backup cannot be written', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    // A folder where the backup file should go: the copy fails.
    mkdirSync(path.join(dir, 'nova.sqlite.v2.bak', 'x'), { recursive: true });
    let error: Error | undefined;
    try {
      openDatabase(file, STEPS.slice(0, 3));
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).toMatch(
      /^No good backup of schema version 2 at .*nova\.sqlite\.v2\.bak: .*Nova Imperium does not start and did not migrate; the database is unchanged\.$/,
    );
    expect(error?.cause).toBeInstanceOf(Error);
    unchanged();
  });

  it('does not migrate when the backup fails its check', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    const refuse = (): void => {
      throw new Error('rows differ');
    };
    expect(() => openDatabase(file, STEPS.slice(0, 3), refuse)).toThrow(
      /No good backup of schema version 2 .*: rows differ\./,
    );
    unchanged();
    // The other backups stay: nothing was pruned for a bad copy.
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
  });

  it('checks integrity, version and rows of a backup', () => {
    openDatabase(file, STEPS.slice(0, 3)).close();
    const db = new Database(file);
    const good = path.join(dir, 'good.bak');
    db.prepare('VACUUM INTO ?').run(good);
    expect(() => verifyBackup(db, good, 3)).not.toThrow();
    expect(() => verifyBackup(db, good, 2)).toThrow(
      'schema version 3 instead of 2',
    );
    db.exec('INSERT INTO a VALUES (9)');
    expect(() => verifyBackup(db, good, 3)).toThrow(
      'table a has 3 rows, the backup 2',
    );
    db.exec('CREATE TABLE b (y INTEGER)');
    db.exec('DELETE FROM a WHERE x = 9');
    expect(() => verifyBackup(db, good, 3)).toThrow(
      'table b has 0 rows, the backup no',
    );
    db.exec('DROP TABLE b');
    const extra = path.join(dir, 'extra.bak');
    db.prepare('VACUUM INTO ?').run(extra);
    const withC = new Database(extra);
    withC.exec('CREATE TABLE c (z INTEGER)');
    withC.close();
    expect(() => verifyBackup(db, extra, 3)).toThrow(
      'table c has no rows, the backup 0',
    );
    const junk = path.join(dir, 'junk.bak');
    writeFileSync(junk, 'not a database file at all, not at all');
    expect(() => verifyBackup(db, junk, 3)).toThrow();
    const missing = path.join(dir, 'missing.bak');
    expect(() => verifyBackup(db, missing, 3)).toThrow();
    expect(existsSync(missing)).toBe(false);
    db.close();
  });

  it('refuses a backup that opens but is damaged', () => {
    // An index whose definition no longer matches its entries: the file
    // opens and counts its rows, only the integrity check finds it.
    const source = new Database(file);
    source.exec('CREATE TABLE a (x INTEGER); CREATE INDEX ax ON a(x)');
    source.exec('INSERT INTO a VALUES (1), (2), (3)');
    const bad = path.join(dir, 'bad.bak');
    source.prepare('VACUUM INTO ?').run(bad);
    const damage = new Database(bad);
    damage.unsafeMode(true);
    damage.pragma('writable_schema = ON');
    damage.exec(
      "UPDATE sqlite_master SET sql = 'CREATE INDEX ax ON a(x + 1)' WHERE name = 'ax'",
    );
    damage.close();
    expect(() => verifyBackup(source, bad, 0)).toThrow(
      'integrity check: row 1 missing from index ax',
    );
    source.close();
  });
});

describe('upgrade of real data with backup and restore', () => {
  // Every released version with generated data (src/test/migrations.ts):
  // the backup holds exactly the old data, and restoring it gives back the
  // old database unchanged.
  const snapshotOf = (f: string) => {
    const db = new Database(f, { readonly: true });
    try {
      return snapshot(db);
    } finally {
      db.close();
    }
  };

  it.each(MIGRATIONS.slice(1).map((_, i) => i + 1))(
    'from schema version %i',
    (from) => {
      for (const plan of fc.sample(plansBefore(from + 1), {
        numRuns: 3,
        seed: from,
      })) {
        rmSync(file, { force: true });
        for (const f of readdirSync(dir)) rmSync(path.join(dir, f));
        const old = openDatabase(file, MIGRATIONS.slice(0, from));
        populate(old, describeSchema(old), plan);
        old.close();
        const before = snapshotOf(file);

        openDatabase(file).close();
        const bak = path.join(dir, `nova.sqlite.v${from}.bak`);
        expect(version(file)).toBe(MIGRATIONS.length);
        expect(version(bak)).toBe(from);
        expect(snapshotOf(bak)).toEqual(before);

        // The restore described in the error message and docs/operations.md.
        copyFileSync(bak, file);
        rmSync(`${file}-wal`, { force: true });
        rmSync(`${file}-shm`, { force: true });
        openDatabase(file, MIGRATIONS.slice(0, from)).close();
        expect(snapshotOf(file)).toEqual(before);
      }
    },
  );
});
