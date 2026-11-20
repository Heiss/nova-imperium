// The helpers that make the server tests fast: the written-out test password,
// the statement cache of `testCtx` and the rewound database of a property test.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { statementCache } from '../test/statement-cache.ts';
import { hashPassword } from './auth.ts';
import {
  addUser,
  caseDatabase,
  TEST_PASSWORD_HASH,
  testCtx,
} from './test-helpers.ts';

describe('the test password', () => {
  it('is what hashPassword gives for the password and salt addUser uses', () => {
    // Fails when the scrypt profile of auth.ts changes: write the new value
    // into TEST_PASSWORD_HASH.
    expect(TEST_PASSWORD_HASH).toBe(hashPassword('secret1', 'salt'));
    const user = addUser(testCtx(), 'Anna');
    expect([user.salt, user.pw]).toEqual(['salt', TEST_PASSWORD_HASH]);
  });
});

describe('the statement cache', () => {
  const plain = (): Database.Database => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (a INTEGER, b TEXT)');
    db.exec("INSERT INTO t VALUES (1, 'x'), (2, 'y')");
    return db;
  };

  it('hands out the same statement for the same text while it is on, a new one when off', () => {
    const db = plain();
    const cache = statementCache(db);
    expect(db.prepare('SELECT a FROM t')).not.toBe(
      db.prepare('SELECT a FROM t'),
    );
    cache.on();
    expect(db.prepare('SELECT a FROM t')).toBe(db.prepare('SELECT a FROM t'));
    expect(db.prepare('SELECT b FROM t')).not.toBe(
      db.prepare('SELECT a FROM t'),
    );
    cache.off();
    expect(db.prepare('SELECT a FROM t')).not.toBe(
      db.prepare('SELECT a FROM t'),
    );
  });

  it('keeps a statement of the text as it was when another caller plucks, reads raw or binds', () => {
    const db = plain();
    statementCache(db).on();
    const sql = 'SELECT a, b FROM t ORDER BY a';
    expect(db.prepare(sql).pluck().all()).toEqual([1, 2]);
    expect(db.prepare(sql).raw().all()).toEqual([
      [1, 'x'],
      [2, 'y'],
    ]);
    expect(db.prepare(sql).all()).toEqual([
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ]);
    expect(
      db.prepare('SELECT b FROM t WHERE a = ?').bind(2).pluck().get(),
    ).toBe('y');
    expect(db.prepare('SELECT b FROM t WHERE a = ?').pluck().get(1)).toBe('x');
  });

  it('answers a closed database with its own error and follows a changed schema', () => {
    const db = plain();
    statementCache(db).on();
    const select = db.prepare('SELECT * FROM t');
    expect(select.all()).toHaveLength(2);
    db.exec('ALTER TABLE t ADD COLUMN c INTEGER');
    expect(Object.keys(select.get() as object)).toEqual(['a', 'b', 'c']);
    db.exec('DROP TABLE t');
    expect(() => select.all()).toThrow('no such table: t');
    db.close();
    expect(() => db.prepare('SELECT 1')).toThrow('not open');
  });

  it('is on for the database of testCtx and off for one that is handed in', () => {
    const own = testCtx();
    expect(own.db.prepare('SELECT 1')).toBe(own.db.prepare('SELECT 1'));
    own.statements.off();
    expect(own.db.prepare('SELECT 1')).not.toBe(own.db.prepare('SELECT 1'));
    const given = testCtx(1, 1, new Database(':memory:'));
    expect(given.db.prepare('SELECT 1')).not.toBe(given.db.prepare('SELECT 1'));
  });
});

describe('the rewound database of a property test', () => {
  const count = (db: Database.Database, table: string): number =>
    db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number;

  it('hands out the migrated database empty again after every case', () => {
    const cases = caseDatabase();
    const first = cases.open();
    const before = count(first, 'sessions');
    addUser(testCtx(1, 1, first), 'Anna');
    expect(count(first, 'users')).toBe(1);
    cases.rewind();
    const second = cases.open();
    expect(second).toBe(first);
    expect(count(second, 'users')).toBe(0);
    expect(count(second, 'sessions')).toBe(before);
    // The same ids again: nothing of the first case is left.
    addUser(testCtx(1, 1, second), 'Anna');
    expect(count(second, 'users')).toBe(1);
    cases.rewind();
  });

  it('rewinds a case that ended without it when the next one opens', () => {
    const cases = caseDatabase();
    addUser(testCtx(1, 1, cases.open()), 'Bert');
    const next = cases.open();
    expect(count(next, 'users')).toBe(0);
    cases.rewind();
    cases.rewind();
    expect(count(cases.open(), 'users')).toBe(0);
  });

  it('keeps what a case writes inside its transactions, rolled back too', () => {
    const cases = caseDatabase();
    const ctx = testCtx(1, 1, cases.open());
    ctx.store.tx(() => addUser(ctx, 'Cora'));
    expect(count(ctx.db, 'users')).toBe(1);
    expect(() =>
      ctx.store.tx(() => {
        addUser(ctx, 'Dora');
        throw new Error('undone');
      }),
    ).toThrow('undone');
    expect(count(ctx.db, 'users')).toBe(1);
    cases.rewind();
    expect(count(cases.open(), 'users')).toBe(0);
    cases.rewind();
  });
});
