// Opens the SQLite database, sets safe defaults and runs the migrations.
// Before a migration of an existing database file, a copy with the old schema
// version is kept next to it (`nova.sqlite.v8.bak`), the newest three stay.
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { MIGRATIONS } from './schema.ts';

export type Db = Database.Database;

export function isDatabaseBusy(error: unknown): boolean {
  if (!(error instanceof Database.SqliteError)) return false;
  return error.code === 'SQLITE_BUSY' || error.code.startsWith('SQLITE_BUSY_');
}

export function migrate(
  db: Db,
  migrations: readonly string[] = MIGRATIONS,
): number {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > migrations.length)
    throw new Error(
      `The database has schema version ${current}, this server knows ${migrations.length}. Use the newer image or restore a backup.`,
    );
  const run = db.transaction(() => {
    for (let v = current; v < migrations.length; v++) {
      db.exec(migrations[v]!);
      db.pragma(`user_version = ${v + 1}`);
    }
  });
  run();
  return migrations.length - current;
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

/** A consistent single-file copy (WAL included) before the schema changes. */
function backup(
  db: Db,
  file: string,
  migrations: readonly string[],
): string | null {
  const current = db.pragma('user_version', { simple: true }) as number;
  // ':memory:' is always new (version 0), so it never gets a copy.
  if (current === 0 || current >= migrations.length) return null;
  const target = backupName(file, current);
  rmSync(target, { force: true });
  db.prepare('VACUUM INTO ?').run(target);
  pruneBackups(file);
  return target;
}

function migrateWithBackup(
  db: Db,
  file: string,
  migrations: readonly string[],
): void {
  const from = db.pragma('user_version', { simple: true }) as number;
  const saved = backup(db, file, migrations);
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
  migrations: readonly string[] = MIGRATIONS,
): Db {
  const db = new Database(file);
  // WAL: readers do not block the writer, a crash does not damage the file.
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrateWithBackup(db, file, migrations);
  return db;
}
