import { describe, expect, it } from 'vitest';
import { migrationHistoryViolation } from './migration-history.ts';

const base = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER);'];

describe('migration history', () => {
  it('accepts an unchanged history and appended migrations', () => {
    expect(migrationHistoryViolation(base, base)).toBeNull();
    expect(
      migrationHistoryViolation(base, [...base, 'DROP TABLE a;']),
    ).toBeNull();
    expect(migrationHistoryViolation([], base)).toBeNull();
  });

  it('rejects a removed migration', () => {
    expect(migrationHistoryViolation(base, base.slice(0, 1))).toBe(
      'Migrations were removed: the base has 2, this change has 1.',
    );
  });

  it('rejects moved migrations and names the first one', () => {
    expect(migrationHistoryViolation(base, [base[1]!, base[0]!])).toMatch(
      /^Migration 1 differs from the base\./,
    );
  });

  it('rejects a migration inserted before a released one', () => {
    expect(
      migrationHistoryViolation(base, [base[0]!, 'SELECT 1;', base[1]!]),
    ).toMatch(/^Migration 2 differs/);
  });

  it('rejects any change of a released migration, whitespace included', () => {
    expect(migrationHistoryViolation(base, [base[0]!, `${base[1]!} `])).toMatch(
      /^Migration 2 differs.*add a new migration at the end\.$/,
    );
  });
});
