// The script for the ID of a new migration and the reading of migrations at
// a git ref in each of their layouts (owner, 2026-11-16, #213).
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FOLDER,
  migrationsAt,
  newestReleaseTag,
} from '../../scripts/migration-refs.ts';
import {
  create,
  nextMigrationId,
  skeleton,
  stamp,
} from '../../scripts/new-migration.ts';
import { loadMigrations } from '../server/db/migration-files.ts';

const now = new Date('2026-11-16T14:05:42Z');

describe('the ID of a new migration', () => {
  it('is the current UTC minute and the short name', () => {
    expect(stamp(now)).toBe('20261116T1405');
    expect(stamp(new Date('2027-01-02T03:04:59.999Z'))).toBe('20270102T0304');
    expect(nextMigrationId(now, 'fleet-cargo', [], undefined)).toBe(
      '20261116T1405-fleet-cargo',
    );
  });

  it('takes the next free minute when the ID is taken', () => {
    const taken = ['20261116T1405-cargo', '20261116T1406-cargo'];
    expect(nextMigrationId(now, 'cargo', taken, undefined)).toBe(
      '20261116T1407-cargo',
    );
    // Another name in the same minute is free.
    expect(nextMigrationId(now, 'other', taken, undefined)).toBe(
      '20261116T1405-other',
    );
    const midnight = new Date('2026-12-31T23:59:30Z');
    expect(nextMigrationId(midnight, 'x', ['20261231T2359-x'], undefined)).toBe(
      '20270101T0000-x',
    );
  });

  it('must be newer than the newest migration of the last release', () => {
    expect(nextMigrationId(now, 'cargo', [], '20261116T1404-zzz')).toBe(
      '20261116T1405-cargo',
    );
    for (const newest of [
      '20261116T1405-cargo',
      '20261116T1405-d',
      '20261117T0000-a',
    ])
      expect(() => nextMigrationId(now, 'cargo', [], newest), newest).toThrow(
        `20261116T1405-cargo is not newer than ${newest}, the newest migration of the last release. Check the clock: a new migration needs an ID after the last release.`,
      );
  });

  it('refuses a name that makes no valid ID', () => {
    for (const name of ['Cargo', 'fleet_cargo', '', 'a--b'])
      expect(() => nextMigrationId(now, name, [], undefined), name).toThrow(
        'is no migration ID',
      );
  });
});

describe('the file of a new issue', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'nova-new-migration-'));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('is a list the loader reads', async () => {
    const file = create(root, '213', '20261116T1405-cargo');
    expect(file).toBe(path.join(root, FOLDER, '213', 'migrations.ts'));
    expect(readFileSync(file, 'utf8')).toBe(
      skeleton('213', '20261116T1405-cargo'),
    );
    expect(await loadMigrations(path.join(root, FOLDER))).toEqual([
      { id: '20261116T1405-cargo', sql: '\n  ' },
    ]);
  });

  it('is never overwritten', () => {
    expect(() => create(root, '213', '20261116T1406-more')).toThrow(
      `${path.join(root, FOLDER, '213', 'migrations.ts')} exists: add { id: '20261116T1406-more', sql: ... } to its list.`,
    );
    expect(existsSync(path.join(root, FOLDER, '214'))).toBe(false);
  });
});

// A throwaway repository with the three layouts of the migrations: SQL
// strings in schema.ts (26.11.22 and older), { id, sql } records in
// schema.ts, and the folder of files.
describe('the migrations at a git ref', () => {
  let repo: string;
  const git = (...args: string[]): string =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.org', ...args],
      { cwd: repo, encoding: 'utf8' },
    );
  const write = (file: string, text: string): void => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), text);
  };
  const commit = (tag?: string): void => {
    git('add', '-A');
    git('commit', '-q', '-m', 'step');
    if (tag) git('tag', tag);
  };

  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'nova-migration-refs-'));
    git('init', '-q');
    write(
      'src/server/db/schema.ts',
      "export const MIGRATIONS: readonly string[] = ['CREATE TABLE a (x)', 'CREATE TABLE b (y)'];\n",
    );
    commit('26.9.1');
    write(
      'src/server/db/schema.ts',
      "export type Migration = { id: string; sql: string };\nexport const MIGRATIONS: readonly Migration[] = [{ id: '20261101T0800-a', sql: 'CREATE TABLE a (x)' }, { id: '20261102T0800-b', sql: 'CREATE TABLE b (y)' }];\n",
    );
    commit('26.10.30');
    write(
      'src/server/db/schema.ts',
      "export const MIGRATIONS = await Promise.resolve('loaded from the folder');\n",
    );
    write(
      `${FOLDER}/legacy/20261101T0800-a.ts`,
      "export const id = '20261101T0800-a';\nexport const number = 1;\nexport const sql = 'CREATE TABLE a (x)';\n",
    );
    write(
      `${FOLDER}/legacy/20261102T0800-b.ts`,
      "export const id = '20261102T0800-b';\nexport const number = 2;\nexport const sql = 'CREATE TABLE b (y)';\n",
    );
    write(
      `${FOLDER}/219/migrations.ts`,
      "import type { Migration } from '../../migration-files.ts';\nconst m: Migration[] = [{ id: '20261116T1405-c', sql: 'CREATE TABLE c (z)' }];\nexport default m;\n",
    );
    commit('26.11.2');
    write('README.md', 'not a migration\n');
    commit();
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('reads SQL strings, records and the folder', async () => {
    expect(await migrationsAt('26.9.1', repo)).toEqual([
      'CREATE TABLE a (x)',
      'CREATE TABLE b (y)',
    ]);
    expect(await migrationsAt('26.10.30', repo)).toEqual([
      { id: '20261101T0800-a', sql: 'CREATE TABLE a (x)' },
      { id: '20261102T0800-b', sql: 'CREATE TABLE b (y)' },
    ]);
    expect(await migrationsAt('HEAD', repo)).toEqual([
      { id: '20261101T0800-a', number: 1, sql: 'CREATE TABLE a (x)' },
      { id: '20261102T0800-b', number: 2, sql: 'CREATE TABLE b (y)' },
      { id: '20261116T1405-c', sql: 'CREATE TABLE c (z)' },
    ]);
  });

  it('finds the newest release tag as a version, not as text', () => {
    expect(newestReleaseTag(undefined, repo)).toBe('26.11.2');
    expect(newestReleaseTag('26.10.30', repo)).toBe('26.10.30');
  });

  it('refuses a schema.ts without a list of migrations', async () => {
    git('checkout', '-q', '-b', 'broken', '26.9.1');
    write('src/server/db/schema.ts', 'export const MIGRATIONS = [1];\n');
    commit();
    await expect(migrationsAt('broken', repo)).rejects.toThrow(
      'src/server/db/schema.ts at broken does not export MIGRATIONS as a list of migrations.',
    );
    git('checkout', '-q', '-');
  });
});
