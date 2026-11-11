// A released migration is never moved, removed or changed: a database only
// runs the migrations above its user_version, so any of these is silently
// skipped on existing databases. A new schema change is a new entry at the
// end. The CI job "Migrations append-only" compares a change with its base.

/** Returns why `head` does not only append to `base`, or null. */
export function migrationHistoryViolation(
  base: readonly string[],
  head: readonly string[],
): string | null {
  if (head.length < base.length)
    return `Migrations were removed: the base has ${base.length}, this change has ${head.length}.`;
  const changed = base.findIndex((sql, i) => sql !== head[i]);
  if (changed === -1) return null;
  return `Migration ${changed + 1} differs from the base. Released migrations are never moved or changed; add a new migration at the end.`;
}
