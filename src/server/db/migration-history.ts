// A released migration is never moved, removed or changed, and its ID stays:
// a database records the IDs it has run (schema_migrations), so a changed
// migration is silently skipped on existing databases. A new schema change is
// a new entry at the end with an ID that sorts after every released one
// (#213). The CI job "Migrations append-only" compares a change with its base.
import type { Migration } from './schema.ts';

/** A migration of a base commit; one before #213 is its SQL without an ID. */
export type ReleasedMigration = string | Migration;

const ID = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why `id` is no migration ID (`YYYYMMDDTHHMM-short-name` in UTC), or null. */
export function idViolation(id: string): string | null {
  const parts = ID.exec(id);
  if (!parts)
    return `"${id}" is no migration ID: a UTC time stamp and a short name, for example 20261114T1830-guild-ranks.`;
  const [y, mo, d, h, mi] = parts.slice(1, 6).map(Number) as number[];
  const iso = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!)).toISOString();
  const written = `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}`;
  if (!iso.startsWith(written)) return `"${id}" names no valid UTC time.`;
  return null;
}

/** Why the migrations are not listed in strict order of valid IDs, or null. */
export function orderViolation(
  migrations: readonly Migration[],
): string | null {
  for (const [i, { id }] of migrations.entries()) {
    const invalid = idViolation(id);
    if (invalid) return `Migration ${i + 1}: ${invalid}`;
    if (i > 0 && migrations[i - 1]!.id >= id)
      return `Migration ${id} does not sort after ${migrations[i - 1]!.id}. Migrations run in the order of their IDs, each ID once; a new migration takes a newer ID and goes at the end.`;
  }
  return null;
}

const differs = (released: ReleasedMigration, now: Migration): boolean =>
  typeof released === 'string'
    ? released !== now.sql
    : released.id !== now.id || released.sql !== now.sql;

/** Returns why `head` does not only append to `base`, or null. */
export function migrationHistoryViolation(
  base: readonly ReleasedMigration[],
  head: readonly Migration[],
): string | null {
  const order = orderViolation(head);
  if (order) return order;
  if (head.length < base.length)
    return `Migrations were removed: the base has ${base.length}, this change has ${head.length}.`;
  const changed = base.findIndex((m, i) => differs(m, head[i]!));
  if (changed === -1) return null;
  return `Migration ${changed + 1} (${head[changed]!.id}) differs from the base. Released migrations keep their ID and SQL and are never moved; add a new migration with a newer ID at the end.`;
}
