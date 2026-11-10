import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUPS_KEPT, openDatabase } from './database.ts';

const STEPS = [
  'CREATE TABLE a (x INTEGER)',
  'INSERT INTO a VALUES (1)',
  'INSERT INTO a VALUES (2)',
  'INSERT INTO a VALUES (3)',
  'INSERT INTO a VALUES (4)',
  'INSERT INTO a VALUES (5)',
];

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'nova-db-'));
  file = path.join(dir, 'nova.sqlite');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const backups = (): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.bak'))
    .sort();

const rows = (f: string): number[] => {
  const db = new Database(f, { readonly: true });
  const r = db.prepare('SELECT x FROM a ORDER BY x').pluck().all() as number[];
  db.close();
  return r;
};

const version = (f: string): number => {
  const db = new Database(f, { readonly: true });
  const v = db.pragma('user_version', { simple: true }) as number;
  db.close();
  return v;
};

describe('backup before migrations', () => {
  it('makes no backup of a new database', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    expect(backups()).toEqual([]);
  });

  it('copies the database with its old schema version before migrating', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
    const bak = path.join(dir, 'nova.sqlite.v2.bak');
    expect(version(bak)).toBe(2);
    expect(rows(bak)).toEqual([1]);
    expect(rows(file)).toEqual([1, 2]);
  });

  it('makes no backup when nothing is to migrate', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 2)).close();
    expect(backups()).toEqual([]);
  });

  it(`keeps only the newest ${BACKUPS_KEPT} backups`, () => {
    expect(BACKUPS_KEPT).toBe(3);
    for (let n = 1; n <= STEPS.length; n++)
      openDatabase(file, STEPS.slice(0, n)).close();
    expect(backups()).toEqual([
      'nova.sqlite.v3.bak',
      'nova.sqlite.v4.bak',
      'nova.sqlite.v5.bak',
    ]);
  });

  it('replaces a backup of the same version', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    const db = new Database(file);
    db.pragma('user_version = 2');
    db.close();
    openDatabase(file, STEPS.slice(0, 3)).close();
    expect(backups()).toEqual(['nova.sqlite.v2.bak']);
    expect(rows(path.join(dir, 'nova.sqlite.v2.bak'))).toEqual([1, 2]);
  });

  it('leaves other files alone', () => {
    openDatabase(path.join(dir, 'other.sqlite'), STEPS.slice(0, 1)).close();
    openDatabase(path.join(dir, 'other.sqlite'), STEPS.slice(0, 2)).close();
    for (let n = 1; n <= 5; n++) openDatabase(file, STEPS.slice(0, n)).close();
    expect(backups()).toContain('other.sqlite.v1.bak');
  });

  it('names the backup when a migration fails and changes nothing', () => {
    openDatabase(file, STEPS.slice(0, 2)).close();
    let error: Error | undefined;
    try {
      openDatabase(file, [...STEPS.slice(0, 2), 'INSERT INTO nope VALUES (1)']);
    } catch (e) {
      error = e as Error;
    }
    const bak = path.join(dir, 'nova.sqlite.v2.bak');
    expect(error?.message).toContain('Migration from schema version 2 failed');
    expect(error?.message).toContain(bak);
    expect(error?.message).toContain('no such table: nope');
    expect(error?.cause).toBeInstanceOf(Error);
    expect(existsSync(bak)).toBe(true);
    expect(version(file)).toBe(2);
    expect(rows(file)).toEqual([1]);
  });

  it('keeps the plain error for a database without backup', () => {
    expect(() =>
      openDatabase(':memory:', ['INSERT INTO nope VALUES (1)']),
    ).toThrow(/^no such table: nope$/);
  });
});
