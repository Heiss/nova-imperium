import { existsSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  changesExisting,
  plansBefore,
  upgrade,
  type Plan,
} from '../../test/migrations.ts';
import { MIGRATIONS, type Migration } from './schema.ts';

// Every migration runs on generated, valid data of the version before it.
// Pull requests use a fixed seed; the nightly run sets MIGRATION_SEED=random
// and more runs. A failure prints the seed and the shrunk counterexample.
const RUNS = Number(process.env.MIGRATION_RUNS ?? 100);
const SEED =
  process.env.MIGRATION_SEED === 'random'
    ? undefined
    : Number(process.env.MIGRATION_SEED ?? 20261110);
// About 10 ms per run on a laptop; the default limit of 5 s is too short
// on slow runners and for 1000 runs.
const TIMEOUT = Math.max(10_000, RUNS * 50);
// The classification is always deterministic.
const CLASSIFY = { numRuns: 25, seed: 1 };

// The upgrade test of a migration is named after its ID (#213), so it keeps
// its name when another migration sorts before it; the 20 migrations from
// before the IDs keep the name with their number.
const upgradeTests = (n: number): string[] => {
  const { id, number } = MIGRATIONS[n - 1]!;
  return [
    `src/server/db/upgrades/${id}.test.ts`,
    ...(number === undefined
      ? []
      : [`src/server/db/upgrades/migration-${number}.test.ts`]),
  ];
};

/** The property: the upgrade succeeds and leaves a consistent database. */
function consistentUpgrade(
  n: number,
  migrations: readonly Migration[],
  numRuns = RUNS,
  shrink = true,
): void {
  fc.assert(
    fc.property(plansBefore(n, migrations), (plan) => {
      const result = upgrade(n, plan, migrations);
      expect(result.integrity).toBe('ok');
      expect(result.foreignKeys).toEqual([]);
    }),
    // Without shrinking, a failure ends at the first counterexample.
    { numRuns, seed: SEED, endOnFailure: !shrink },
  );
}

/** Whether migration n changes existing tables or data on generated data. */
function isChanging(n: number, migrations: readonly Migration[]): boolean {
  return fc.sample(plansBefore(n, migrations), CLASSIFY).some((plan: Plan) => {
    const { before, after } = upgrade(n, plan, migrations);
    return changesExisting(before, after);
  });
}

describe.each(MIGRATIONS.map((_, i) => i + 1))('migration %i', (n) => {
  it(
    'upgrades any valid data of the previous version consistently',
    { timeout: TIMEOUT },
    () => consistentUpgrade(n, MIGRATIONS),
  );

  it('has its own upgrade test when it changes existing tables or data', () => {
    if (isChanging(n, MIGRATIONS))
      expect(
        upgradeTests(n).some((f) => existsSync(f)),
        `Migration ${n} changes existing tables or data; add ${upgradeTests(n)[0]}.`,
      ).toBe(true);
  });
});

// The checks above must find problems; these migrations are deliberately bad
// or harmless and run after the real ones.
describe('self-test of the migration checks', { timeout: TIMEOUT }, () => {
  const next = MIGRATIONS.length + 1;
  const withExtra = (sql: string): Migration[] => [
    ...MIGRATIONS,
    { id: '99991231T2359-self-test', sql },
  ];

  /** The error behind the property failure, or null when it held. */
  const failure = (migrations: readonly Migration[]): string | null => {
    try {
      consistentUpgrade(next, migrations, 50, false);
      return null;
    } catch (error) {
      return String((error as Error).cause);
    }
  };

  it('finds a migration that fails on existing data', () => {
    const bad = withExtra('CREATE UNIQUE INDEX probes_once ON users(probes);');
    expect(failure(bad)).toMatch(/UNIQUE constraint failed: users\.probes/);
  });

  it('finds a migration that fails on a foreign key of existing data', () => {
    const bad = withExtra('DELETE FROM users;');
    expect(failure(bad)).toMatch(/FOREIGN KEY constraint failed/);
  });

  it('accepts a harmless migration', () => {
    expect(
      failure(withExtra('CREATE TABLE extra (a INTEGER) STRICT;')),
    ).toBeNull();
  });

  it('classifies changes of data and schema, but not new tables', () => {
    expect(isChanging(next, withExtra('DELETE FROM reports;'))).toBe(true);
    expect(
      isChanging(next, withExtra('ALTER TABLE users ADD COLUMN x TEXT;')),
    ).toBe(true);
    expect(
      isChanging(next, withExtra('CREATE TABLE extra (a INTEGER) STRICT;')),
    ).toBe(false);
  });
});
