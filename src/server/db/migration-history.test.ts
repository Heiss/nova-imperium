import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  idViolation,
  migrationHistoryViolation,
  newestReleasedId,
  orderViolation,
} from './migration-history.ts';
import { MIGRATIONS, type Migration } from './schema.ts';

const a = { id: '20261101T0800-a', sql: 'CREATE TABLE a (x INTEGER);' };
const b = { id: '20261102T0900-b', sql: 'CREATE TABLE b (y INTEGER);' };
const c = { id: '20261103T1000-c', sql: 'DROP TABLE a;' };
const base: Migration[] = [a, b];

describe('migration IDs', () => {
  it('accepts a UTC time stamp and a short name', () => {
    for (const id of [
      '20261114T1830-guild-ranks',
      '20261114T1830-v2',
      '20261114T1830-2',
      '20240229T0000-leap-day',
      '20261231T2359-a-b-c',
    ])
      expect(idViolation(id), id).toBeNull();
  });

  it('refuses anything else and says what an ID is', () => {
    for (const id of [
      '',
      '20261114T1830',
      '20261114T1830-',
      '20261114T1830--a',
      '20261114T1830-a-',
      '20261114T1830-a--b',
      '20261114T1830-Guild',
      '20261114T1830-guild_ranks',
      '20261114T1830-gilde-ä',
      '20261114t1830-a',
      '20261114 1830-a',
      '20261114T183-a',
      '2026114T1830-a',
      '202611145T1830-a',
      '20261114T18300-a',
      'x20261114T1830-a',
      '20261114T1830-a!',
      '20261114T1830-a\n',
      '2026111aT1830-a',
      '20261114T18a0-a',
    ])
      expect(idViolation(id), JSON.stringify(id)).toBe(
        `"${id}" is no migration ID: a UTC time stamp and a short name, for example 20261114T1830-guild-ranks.`,
      );
  });

  it('refuses a time that does not exist', () => {
    for (const id of [
      '20261301T0000-a',
      '20260001T0000-a',
      '20261100T0000-a',
      '20260230T0000-a',
      '20250229T0000-a',
      '20261114T2400-a',
      '20261114T1860-a',
    ])
      expect(idViolation(id), id).toBe(`"${id}" names no valid UTC time.`);
  });

  it('gives each released migration a valid ID, in order', () => {
    expect(orderViolation(MIGRATIONS)).toBeNull();
  });
});

describe('order of the migrations', () => {
  it('accepts IDs in strict order', () => {
    expect(orderViolation([])).toBeNull();
    expect(orderViolation([a])).toBeNull();
    expect(orderViolation([a, b, c])).toBeNull();
  });

  it('refuses an ID out of order and the same ID twice', () => {
    const message = (id: string, before: string): string =>
      `Migration ${id} does not sort after ${before}. Migrations are listed and run in the order of their IDs, each ID once.`;
    expect(orderViolation([b, a])).toBe(message(a.id, b.id));
    expect(orderViolation([a, c, b])).toBe(message(b.id, c.id));
    expect(orderViolation([a, { ...b, id: a.id }])).toBe(message(a.id, a.id));
  });

  it('refuses an invalid ID and names its place', () => {
    expect(orderViolation([a, { ...b, id: 'b' }])).toBe(
      'Migration 2: "b" is no migration ID: a UTC time stamp and a short name, for example 20261114T1830-guild-ranks.',
    );
    expect(orderViolation([{ ...a, id: '20261399T0000-a' }])).toBe(
      'Migration 1: "20261399T0000-a" names no valid UTC time.',
    );
  });

  // Any set of valid IDs is accepted sorted and refused in any other order.
  const time = fc
    .date({
      min: new Date('2000-01-01T00:00Z'),
      max: new Date('2099-12-31T23:59Z'),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString().slice(0, 16).replaceAll(/[-:]/g, ''));
  const name = fc.stringMatching(/^[a-z0-9]{1,6}(-[a-z0-9]{1,6}){0,2}$/);
  const ids = fc.uniqueArray(
    fc.tuple(time, name).map(([t, n]) => `${t}-${n}`),
    { minLength: 2, maxLength: 8 },
  );
  const asMigrations = (list: string[]): Migration[] =>
    list.map((id) => ({ id, sql: `-- ${id}` }));

  it('accepts every set of valid IDs in sorted order (property)', () => {
    fc.assert(
      fc.property(ids, (list) => {
        expect(orderViolation(asMigrations(list.toSorted()))).toBeNull();
      }),
      { seed: 213 },
    );
  });

  it('refuses every other order of the same IDs (property)', () => {
    fc.assert(
      fc.property(ids, fc.nat(), fc.nat(), (list, i, j) => {
        const sorted = list.toSorted();
        const [x, y] = [i % sorted.length, j % sorted.length];
        fc.pre(x !== y);
        const swapped = sorted.with(x, sorted[y]!).with(y, sorted[x]!);
        expect(orderViolation(asMigrations(swapped))).toMatch(
          / does not sort after /,
        );
      }),
      { seed: 213 },
    );
  });
});

describe('migration history', () => {
  const differs = (id: string, what = 'the base'): string =>
    `Migration ${id} is on ${what} and must not change any more; change only your own new migration.`;
  const gone = (id: string, what = 'the base'): string =>
    `Migration ${id} is on ${what} and must not be removed or get another ID; change only your own new migration.`;
  const early = (id: string, newest: string): string =>
    `Migration ${id} is older than ${newest}, the newest migration of the last release. A new migration needs an ID after the last release.`;

  it('accepts an unchanged history and appended migrations', () => {
    expect(migrationHistoryViolation(base, base)).toBeNull();
    expect(migrationHistoryViolation(base, [...base, c])).toBeNull();
    expect(migrationHistoryViolation([], base)).toBeNull();
    expect(migrationHistoryViolation(base, [...base, c], base)).toBeNull();
  });

  it('rejects a removed migration', () => {
    expect(migrationHistoryViolation(base, base.slice(0, 1))).toBe(
      'Migrations were removed: the base has 2, this change has 1.',
    );
    expect(migrationHistoryViolation(base, [a, c])).toBe(gone(b.id));
  });

  it('rejects moved migrations and names the first one', () => {
    const swapped = [
      { ...a, sql: b.sql },
      { ...b, sql: a.sql },
    ];
    expect(migrationHistoryViolation(base, swapped)).toBe(differs(a.id));
  });

  it('rejects any change of a migration of the base, whitespace included', () => {
    expect(
      migrationHistoryViolation(base, [a, { ...b, sql: `${b.sql} ` }]),
    ).toBe(differs(b.id));
  });

  it('rejects a changed ID of a migration of the base', () => {
    const renamed = { ...b, id: '20261102T0900-renamed' };
    expect(migrationHistoryViolation(base, [a, renamed])).toBe(gone(b.id));
  });

  it('rejects a change whose migrations are not in order', () => {
    expect(migrationHistoryViolation([], [b, a])).toMatch(
      /^Migration 20261101T0800-a does not sort after 20261102T0900-b\./,
    );
  });

  // Acceptance criterion 1 of #213 under the rule of the owner
  // (2026-11-16): two pull requests that each add a migration after the
  // last release merge in either order, without a new ID.
  it('merges two unreleased migrations in either order', () => {
    const release = [a];
    // b first, then c (c is newer): c goes at the end.
    expect(migrationHistoryViolation([a, b], [a, b, c], release)).toBeNull();
    // c first, then b (b is older): b goes before c.
    expect(migrationHistoryViolation([a, c], [a, b, c], release)).toBeNull();
  });

  it('rejects a new migration older than the newest of the last release', () => {
    const older = { id: '20261101T2000-older', sql: 'SELECT 1;' };
    expect(migrationHistoryViolation([a, b], [a, older, b, c], [a, b])).toBe(
      early(older.id, b.id),
    );
    const oldest = { id: '20261101T0700-oldest', sql: 'SELECT 1;' };
    expect(migrationHistoryViolation([a, b], [oldest, a, b], [a])).toBe(
      early(oldest.id, a.id),
    );
    expect(migrationHistoryViolation([a], [a, older], [a])).toBeNull();
  });

  // Migrations of the base were checked when they came; only those new in
  // the change are held against the newest migration of the release.
  it('holds only the migrations new in the change against the release', () => {
    const later = { id: '20261102T1200-later', sql: 'SELECT 2;' };
    expect(
      migrationHistoryViolation([a, b, c], [a, b, later, c], [a, later]),
    ).toBeNull();
  });

  // O19 (owner, 2026-11-16): a hotfix brings no migration; schema changes
  // go through main and a normal release. The release is the tag the
  // hotfix branch starts from.
  it('rejects every new migration on a hotfix branch', () => {
    const fix = (id: string): string =>
      `Migration ${id} is new on a hotfix branch. A hotfix brings no migration; schema changes go through main and a normal release.`;
    expect(migrationHistoryViolation([a, b], [a, b], [a, b], true)).toBeNull();
    expect(migrationHistoryViolation([a, b], [a, b, c], [a, b], true)).toBe(
      fix(c.id),
    );
    // Newer than the release or not, it is refused all the same.
    expect(migrationHistoryViolation([a, b], [a, b, c], [a, b])).toBeNull();
    expect(migrationHistoryViolation([a], [a, b, c], [a], true)).toBe(
      fix(b.id),
    );
    // A release tag from before #213 lists the SQL only.
    expect(migrationHistoryViolation([a.sql], [a], [a.sql], true)).toBeNull();
    expect(migrationHistoryViolation([a.sql], [a, b], [a.sql], true)).toBe(
      fix(b.id),
    );
    // A lost or changed migration is reported as without --hotfix.
    expect(migrationHistoryViolation([a, b], [a], [a, b], true)).toBe(
      'Migrations were removed: the base has 2, this change has 1.',
    );
  });

  it('uses the IDs of a base with IDs, not their places', () => {
    const later = { id: '20261104T0000-later', sql: 'SELECT 2;' };
    expect(
      migrationHistoryViolation([b, c], [a, b, c, later], [a, later]),
    ).toBeNull();
    expect(migrationHistoryViolation([], [a, b], [a, b])).toBeNull();
  });

  it('rejects a lost or changed migration of the last release', () => {
    const release = 'the last release';
    expect(migrationHistoryViolation([], [b], [a, b])).toBe(
      'Migrations were removed: the last release has 2, this change has 1.',
    );
    expect(migrationHistoryViolation([], [b, c], [a, b])).toBe(
      gone(a.id, release),
    );
    expect(
      migrationHistoryViolation([], [{ ...a, sql: 'SELECT 3;' }, b], [a, b]),
    ).toBe(differs(a.id, release));
  });

  // A base or release from before #213 lists the SQL only: its migrations
  // are the first of the change, in order, byte for byte (D2).
  it('compares a base without IDs by its SQL, in order', () => {
    const old = [a.sql, b.sql];
    expect(migrationHistoryViolation(old, base)).toBeNull();
    expect(migrationHistoryViolation(old, [...base, c])).toBeNull();
    // This pull request: base and release without IDs, the IDs attached.
    expect(migrationHistoryViolation(old, [...base, c], [a.sql])).toBeNull();
    expect(migrationHistoryViolation(old, [a])).toBe(
      'Migrations were removed: the base has 2, this change has 1.',
    );
    expect(
      migrationHistoryViolation(old, [a, { ...b, sql: `${b.sql}\n` }]),
    ).toBe(differs(b.id));
    expect(migrationHistoryViolation(old, [{ ...a, sql: b.sql }, c])).toBe(
      differs(a.id),
    );
  });

  it('compares a release without IDs by its SQL, in order', () => {
    const old = [a.sql];
    const between = { id: '20261102T1000-between', sql: 'SELECT 4;' };
    expect(migrationHistoryViolation([a, c], [a, b, c], old)).toBeNull();
    expect(migrationHistoryViolation([a, c], [a, between, c], old)).toBeNull();
    const first = { id: '20261101T0000-first', sql: 'SELECT 5;' };
    expect(migrationHistoryViolation([a], [first, a], old)).toBe(
      differs(first.id, 'the last release'),
    );
  });

  // pnpm check compares with the local origin/main and names it.
  it('names the base as asked', () => {
    expect(
      migrationHistoryViolation(
        base,
        [a, { ...b, sql: 'SELECT 9;' }],
        base,
        false,
        'main',
      ),
    ).toBe(differs(b.id, 'main'));
    expect(migrationHistoryViolation(base, [a, c], base, false, 'main')).toBe(
      gone(b.id, 'main'),
    );
  });

  it('finds the newest migration of a release, with or without IDs', () => {
    expect(newestReleasedId([a, b], [a, b, c])).toBe(b.id);
    expect(newestReleasedId([a, b, c], [a, b, c])).toBe(c.id);
    expect(newestReleasedId([a.sql, b.sql], [a, b, c])).toBe(b.id);
    expect(newestReleasedId([], [a])).toBeUndefined();
  });
});
