import { existsSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  changesExisting,
  plansBefore,
  upgrade,
  type Plan,
} from '../../test/migrations.ts';
import { MIGRATIONS } from './schema.ts';

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

const upgradeTest = (n: number): string =>
  `src/server/db/upgrades/migration-${n}.test.ts`;

/** The property: the upgrade succeeds and leaves a consistent database. */
function consistentUpgrade(
  n: number,
  migrations: readonly string[],
  numRuns = RUNS,
): void {
  fc.assert(
    fc.property(plansBefore(n, migrations), (plan) => {
      const result = upgrade(n, plan, migrations);
      expect(result.integrity).toBe('ok');
      expect(result.foreignKeys).toEqual([]);
    }),
    { numRuns, seed: SEED },
  );
}

/** Whether migration n changes existing tables or data on generated data. */
function isChanging(n: number, migrations: readonly string[]): boolean {
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
        existsSync(upgradeTest(n)),
        `Migration ${n} changes existing tables or data; add ${upgradeTest(n)}.`,
      ).toBe(true);
  });
});

// The checks above must find problems; these migrations are deliberately bad
// or harmless and run after the real ones.
describe('self-test of the migration checks', () => {
  const next = MIGRATIONS.length + 1;
  const withExtra = (sql: string): string[] => [...MIGRATIONS, sql];

  /** The error behind the property failure, or null when it held. */
  const failure = (migrations: readonly string[]): string | null => {
    try {
      consistentUpgrade(next, migrations, 50);
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
