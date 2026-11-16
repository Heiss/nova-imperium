// The migrations of the SQLite database, read from the folder migrations/
// when the server starts (see migration-files.ts; owner, 2026-11-16, #213).
// A migration is never changed or removed once it is on main; a change of
// the schema is a new migration. The CI job "Migrations append-only" and
// `pnpm check` enforce this (migration-history.ts).
//
// Every migration has a fixed ID, a UTC time stamp and a short name
// (`YYYYMMDDTHHMM-name`, #213 D1); the migrations run in the order of their
// IDs, whatever folder they are in, and the table schema_migrations records
// the IDs a database has run (D2). A new migration takes the UTC time it was
// written (`node scripts/new-migration.ts <issue> <name>`); its ID must sort
// after the newest migration of the last release (owner, 2026-11-16). The
// first 20 migrations were numbered by their place (`number`); their time
// stamps are the UTC commit time (minutes, seconds cut) of the commit on
// main that added them. Migrations 7 and 8 came in the same commit; their
// names keep them in their old order.
import { fileURLToPath } from 'node:url';
import { loadMigrations, type Migration } from './migration-files.ts';

export type { Migration };

export const MIGRATIONS: readonly Migration[] = await loadMigrations(
  fileURLToPath(new URL('migrations', import.meta.url)),
);
