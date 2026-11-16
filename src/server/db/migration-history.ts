// A migration on main is never removed or changed, and its ID stays: a
// database records the IDs it has run (schema_migrations), so a changed
// migration is silently skipped on existing databases. A new schema change is
// a new entry with an ID that sorts after the newest migration of the last
// release; unreleased migrations may be merged in any order, the list stays
// sorted by ID (#213, owner, 2026-11-16). The CI job "Migrations
// append-only" compares a change with its base and with the last release.
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
      return `Migration ${id} does not sort after ${migrations[i - 1]!.id}. Migrations are listed and run in the order of their IDs, each ID once.`;
  }
  return null;
}

const KEEP =
  'Migrations keep their ID and SQL byte for byte; correct one with a new migration.';

const changed = (now: Migration, sql: string, what: string): string | null =>
  now.sql === sql ? null : `Migration ${now.id} differs from ${what}. ${KEEP}`;

function keptOne(
  m: Migration,
  head: readonly Migration[],
  what: string,
): string | null {
  const now = head.find((h) => h.id === m.id);
  if (!now)
    return `Migration ${m.id} of ${what} was removed or got another ID. ${KEEP}`;
  return changed(now, m.sql, what);
}

/**
 * Why `head` lost or changed a migration of `list`, or null. A list from
 * before #213 has no IDs: its migrations are the first of `head`, in order.
 */
function keptViolation(
  list: readonly ReleasedMigration[],
  head: readonly Migration[],
  what: string,
): string | null {
  if (head.length < list.length)
    return `Migrations were removed: ${what} has ${list.length}, this change has ${head.length}.`;
  for (const [i, m] of list.entries()) {
    const violation =
      typeof m === 'string'
        ? changed(head[i]!, m, what)
        : keptOne(m, head, what);
    if (violation) return violation;
  }
  return null;
}

/** The IDs of `list` in `head`; a list from before #213 is the first of `head`. */
const idsIn = (
  list: readonly ReleasedMigration[],
  head: readonly Migration[],
): string[] => list.map((m, i) => (typeof m === 'string' ? head[i]!.id : m.id));

/**
 * Why a migration that is new in `head` (neither in the base nor in the
 * release) is older than the newest migration of the release, or null.
 */
function earlyViolation(
  base: readonly ReleasedMigration[],
  release: readonly ReleasedMigration[],
  head: readonly Migration[],
): string | null {
  const released = idsIn(release, head);
  if (released.length === 0) return null;
  const known = new Set([...idsIn(base, head), ...released]);
  const newest = released.at(-1)!;
  // The list is sorted: what stands before the newest released one is older.
  const early = head
    .slice(
      0,
      head.findIndex((m) => m.id === newest),
    )
    .find((m) => !known.has(m.id));
  if (!early) return null;
  return `Migration ${early.id} is older than ${newest}, the newest migration of the last release. A new migration needs an ID after the last release.`;
}

/**
 * Returns why `head` is not sorted by valid IDs, lost or changed a migration
 * of `base` (the base of the pull request) or of `release` (the last release
 * tag), or adds one older than the newest migration of the release; or null.
 * A migration of the base older than the release passes: it was checked when
 * it came, and a hotfix merged back into main brings such a release.
 */
export function migrationHistoryViolation(
  base: readonly ReleasedMigration[],
  head: readonly Migration[],
  release: readonly ReleasedMigration[] = base,
): string | null {
  return (
    orderViolation(head) ??
    keptViolation(base, head, 'the base') ??
    keptViolation(release, head, 'the last release') ??
    earlyViolation(base, release, head)
  );
}
