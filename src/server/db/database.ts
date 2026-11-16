// Opens the SQLite database, sets safe defaults and runs the migrations in
// the order of their IDs, recorded in the table schema_migrations (#213).
// Before a migration of an existing database file, a copy with the old schema
// version is kept next to it (`nova.sqlite.v8.bak`), the newest three stay.
// The copy is checked before the migration runs; without a good copy the
// server does not start and the database stays as it is (fail closed).
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { orderViolation } from './migration-history.ts';
import { MIGRATIONS, type Migration } from './schema.ts';

export type Db = Database.Database;

export function isDatabaseBusy(error: unknown): boolean {
  if (!(error instanceof Database.SqliteError)) return false;
  return error.code === 'SQLITE_BUSY' || error.code.startsWith('SQLITE_BUSY_');
}

const schemaVersion = (db: Db): number =>
  db.pragma('user_version', { simple: true }) as number;

/** Whether the database records the IDs of its migrations (#213). */
const hasHistory = (db: Db): boolean =>
  db
    .prepare(
      "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .pluck()
    .get() === 1;

/**
 * The IDs the database has run. A database from before #213 has run the
 * migrations numbered 1 to its user_version (D2).
 */
function appliedIds(db: Db, migrations: readonly Migration[]): string[] {
  if (hasHistory(db))
    return db
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .pluck()
      .all() as string[];
  const current = schemaVersion(db);
  const numbered = migrations.filter((m) => m.number !== undefined).length;
  if (current > numbered)
    throw new Error(
      `The database has schema version ${current}, this server knows ${numbered}. Use the newer image or restore a backup.`,
    );
  return migrations
    .filter((m) => (m.number ?? Infinity) <= current)
    .map((m) => m.id);
}

/**
 * The migrations the database has still to run, in the order of their IDs.
 * A database that ran a migration this server does not know is refused. An
 * unreleased migration older than one the database ran already still runs:
 * only a database that ran main in between sees that, a release upgrades in
 * the order of the IDs (owner, 2026-11-16, #213).
 */
export function pendingMigrations(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): readonly Migration[] {
  const order = orderViolation(migrations);
  if (order) throw new Error(order);
  const applied = new Set(appliedIds(db, migrations));
  const known = new Set(migrations.map((m) => m.id));
  const unknown = [...applied].find((id) => !known.has(id));
  if (unknown !== undefined)
    throw new Error(
      `The database has run migration ${unknown}, which this server does not know. Use the newer image or restore a backup.`,
    );
  return migrations.filter((m) => !applied.has(m.id));
}

/** Starts the table of run migrations with what user_version says (D2). */
function startHistory(db: Db, migrations: readonly Migration[]): void {
  const done = appliedIds(db, migrations);
  db.exec(
    'CREATE TABLE schema_migrations (id TEXT NOT NULL PRIMARY KEY) STRICT',
  );
  for (const id of done) recordMigration(db, id);
}

function recordMigration(db: Db, id: string): void {
  db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(id);
}

/**
 * Runs the pending migrations in one transaction and records each ID;
 * user_version keeps the number of migrations run, so an older server
 * refuses the database. Returns how many ran.
 */
export function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): number {
  const run = db.transaction(() => {
    const pending = pendingMigrations(db, migrations);
    if (!hasHistory(db)) startHistory(db, migrations);
    let version = migrations.length - pending.length;
    for (const m of pending) {
      db.exec(m.sql);
      recordMigration(db, m.id);
      db.pragma(`user_version = ${++version}`);
    }
    return pending.length;
  });
  return run();
}

export const BACKUPS_KEPT = 3;

const backupName = (file: string, version: number): string =>
  `${file}.v${version}.bak`;

/** The schema version of a backup of `base`, or NaN for any other file. */
function backupVersion(base: string, name: string): number {
  const prefix = `${base}.v`;
  if (!name.startsWith(prefix) || !name.endsWith('.bak')) return NaN;
  const v = name.slice(prefix.length, -'.bak'.length);
  return /^\d+$/.test(v) ? Number(v) : NaN;
}

/** Deletes all but the newest BACKUPS_KEPT backups of this database file. */
function pruneBackups(file: string): void {
  const dir = path.dirname(file);
  const base = path.basename(file);
  readdirSync(dir)
    .map((name) => ({ name, v: backupVersion(base, name) }))
    .filter((x) => !Number.isNaN(x.v))
    .sort((a, b) => b.v - a.v)
    .slice(BACKUPS_KEPT)
    .forEach((x) => rmSync(path.join(dir, x.name)));
}

/** Rows per table, to compare a backup with its source. */
function rowCounts(db: Db): Record<string, number> {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
    .pluck()
    .all() as string[];
  return Object.fromEntries(
    tables.map((t) => [
      t,
      db.prepare(`SELECT count(*) FROM "${t}"`).pluck().get() as number,
    ]),
  );
}

/** The first difference between the rows per table, or null. */
function countDifference(
  a: Record<string, number>,
  b: Record<string, number>,
): string | null {
  for (const t of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (a[t] !== b[t])
      return `table ${t} has ${a[t] ?? 'no'} rows, the backup ${b[t] ?? 'no'}`;
  return null;
}

/**
 * Throws unless the backup at `target` is intact, has schema version
 * `version` and holds as many rows per table as `db`.
 */
export function verifyBackup(db: Db, target: string, version: number): void {
  const copy = new Database(target, { readonly: true, fileMustExist: true });
  try {
    const integrity = copy.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`integrity check: ${integrity}`);
    const v = copy.pragma('user_version', { simple: true }) as number;
    if (v !== version)
      throw new Error(`schema version ${v} instead of ${version}`);
    const diff = countDifference(rowCounts(db), rowCounts(copy));
    if (diff) throw new Error(diff);
  } finally {
    copy.close();
  }
}

export type VerifyBackup = typeof verifyBackup;

/** A consistent single-file copy (WAL included) before the schema changes. */
function backup(
  db: Db,
  file: string,
  current: number,
  verify: VerifyBackup,
): string | null {
  // ':memory:' is always new (version 0), so it never gets a copy.
  if (current === 0) return null;
  const target = backupName(file, current);
  try {
    rmSync(target, { force: true });
    db.prepare('VACUUM INTO ?').run(target);
    verify(db, target, current);
  } catch (e) {
    throw new Error(
      `No good backup of schema version ${current} at ${target}: ${(e as Error).message}. ` +
        `Nova Imperium does not start and did not migrate; the database is unchanged.`,
      { cause: e },
    );
  }
  pruneBackups(file);
  return target;
}

function migrateWithBackup(
  db: Db,
  file: string,
  migrations: readonly Migration[],
  verify: VerifyBackup,
): void {
  const from = schemaVersion(db);
  // Refuses a database this server cannot migrate before any copy. Starting
  // the table of run migrations changes the schema too, so it gets a copy.
  const changes =
    pendingMigrations(db, migrations).length > 0 || !hasHistory(db);
  const saved = changes ? backup(db, file, from, verify) : null;
  try {
    migrate(db, migrations);
  } catch (e) {
    if (!saved) throw e;
    throw new Error(
      `Migration from schema version ${from} failed: ${(e as Error).message}. ` +
        `The migration ran in one transaction and changed nothing. ` +
        `Backup of schema version ${from}: ${saved}. To roll back, stop the server, ` +
        `copy it over ${file}, delete ${file}-wal and ${file}-shm and start the previous version.`,
      { cause: e },
    );
  }
}

/** `file` is a path or ':memory:' (tests). */
export function openDatabase(
  file: string,
  migrations: readonly Migration[] = MIGRATIONS,
  verify: VerifyBackup = verifyBackup,
): Db {
  const db = new Database(file);
  // WAL: readers do not block the writer, a crash does not damage the file.
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  try {
    migrateWithBackup(db, file, migrations, verify);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}
