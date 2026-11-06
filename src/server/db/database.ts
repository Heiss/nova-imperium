// Opens the SQLite database, sets safe defaults and runs the migrations.
import Database from 'better-sqlite3';
import { MIGRATIONS } from './schema.ts';

export type Db = Database.Database;

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

/** `file` is a path or ':memory:' (tests). */
export function openDatabase(file: string): Db {
  const db = new Database(file);
  // WAL: readers do not block the writer, a crash does not damage the file.
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}
