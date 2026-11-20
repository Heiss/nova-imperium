// The rules that hold for every module that says what a new round empties or
// keeps (#317). The test names no feature and no table: a module declares its
// tables in its own file (`roundReset`); what a reset really leaves behind is
// checked against the schema in src/server/game/round-reset.test.ts.
import { describe, expect, it } from 'vitest';
import type { RoundRules } from '../../core/round.ts';
import { ROUND_RESETS } from '../round-reset.gen.ts';
import { openDatabase } from './database.ts';
import {
  clearRound,
  clearsOf,
  keptBy,
  type ListedResets,
  type RoundReset,
} from './round-reset.ts';

const modules: ListedResets = ROUND_RESETS;
const on = { guilds: true } as RoundRules;
const off = { guilds: false } as RoundRules;
const schemaTables = (): string[] =>
  openDatabase(':memory:')
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .pluck()
    .all() as string[];

describe('the list of the round resets', () => {
  it('names each module once, by its path in src/server', () => {
    const names = modules.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9/-]*$/);
  });

  it('gives every step tables of the schema', () => {
    const tables = schemaTables();
    for (const [name, steps] of modules) {
      expect(steps.length, name).toBeGreaterThan(0);
      for (const step of steps) {
        const named = 'clears' in step ? step.clears : step.keeps;
        expect(named.length, name).toBeGreaterThan(0);
        for (const table of named) expect(tables, name).toContain(table);
      }
    }
  });

  it('gives every step that empties tables a number, and a condition a function', () => {
    for (const [name, steps] of modules)
      for (const step of steps) {
        if ('clears' in step)
          expect(Number.isInteger(step.order) && step.order > 0, name).toBe(
            true,
          );
        expect(typeof (step.when ?? (() => true)), name).toBe('function');
      }
  });

  it('uses no order number and no table twice, and runs by the numbers', () => {
    const steps = clearsOf(modules);
    expect(steps.length).toBeGreaterThan(0);
    const orders = steps.map((step) => step.order);
    expect(orders).toEqual([...new Set(orders)].sort((a, b) => a - b));
    const cleared = steps.flatMap((step) => step.clears);
    expect(new Set(cleared).size).toBe(cleared.length);
  });

  it('keeps no table twice, with the guilds on or off', () => {
    for (const rules of [on, off]) {
      const kept = keptBy(modules, rules);
      expect(kept.length).toBeGreaterThan(0);
      expect(new Set(kept).size).toBe(kept.length);
    }
  });

  it('keeps the guild tables only in a round with guilds, and empties them in one without', () => {
    expect(keptBy(modules, on)).toContain('guilds');
    expect(keptBy(modules, off)).not.toContain('guilds');
    const guilds = clearsOf(modules).find((s) => s.clears.includes('guilds'));
    expect(guilds?.when?.(off)).toBe(true);
    expect(guilds?.when?.(on)).toBe(false);
  });
});

describe('the steps of a new round', () => {
  const one = (name: string, ...steps: RoundReset[]): ListedResets[number] => [
    name,
    steps,
  ];

  it('throws when two modules use one order number, naming both files', () => {
    expect(() =>
      clearsOf([
        one('game/one', { order: 10, clears: ['a'] }),
        one('push-store', { order: 10, clears: ['b'] }),
      ]),
    ).toThrow(
      'round reset order "10" is defined in src/server/game/one.ts and in src/server/push-store.ts.',
    );
  });

  it('throws when two modules empty one table, naming both files', () => {
    expect(() =>
      clearsOf([
        one('game/one', { order: 10, clears: ['a'] }),
        one('db/repos/two', { order: 20, clears: ['b', 'a'] }),
      ]),
    ).toThrow(
      'round reset table "a" is defined in src/server/game/one.ts and in src/server/db/repos/two.ts.',
    );
  });

  it('throws for a name that is not a table name', () => {
    expect(() =>
      clearsOf([one('game/one', { order: 10, clears: ['a; DROP TABLE b'] })]),
    ).toThrow('src/server/game/one.ts: "a; DROP TABLE b" is not a table name.');
  });

  it('throws when two modules keep one table, naming both files', () => {
    expect(() =>
      keptBy(
        [one('game/one', { keeps: ['a'] }), one('two', { keeps: ['a'] })],
        on,
      ),
    ).toThrow(
      'kept table "a" is defined in src/server/game/one.ts and in src/server/two.ts.',
    );
  });

  it('keeps a table for the rounds a step says, and lists the kept tables sorted', () => {
    const list = [
      one('b', { keeps: ['y'] }),
      one('a', { keeps: ['z'], when: (rules) => rules.guilds }),
    ];
    expect(keptBy(list, on)).toEqual(['y', 'z']);
    expect(keptBy(list, off)).toEqual(['y']);
  });

  it('empties the tables in the order of the numbers, a table of a step that does not hold stays', () => {
    const db = openDatabase(':memory:');
    db.exec(`
      CREATE TABLE a (x); CREATE TABLE b (x); CREATE TABLE c (x);
      INSERT INTO a VALUES (1); INSERT INTO b VALUES (1); INSERT INTO c VALUES (1);
    `);
    const seen: string[] = [];
    const prepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => (seen.push(sql), prepare(sql))) as never;
    const list = [
      one('game/late', { order: 30, clears: ['c'] }),
      one(
        'game/early',
        { order: 10, clears: ['b', 'a'] },
        { order: 20, clears: ['c2'], when: (rules) => !rules.guilds },
      ),
    ];
    // "c2" does not exist: the step must not run in a round with guilds.
    clearRound(db, on, list);
    expect(seen).toEqual(['DELETE FROM b', 'DELETE FROM a', 'DELETE FROM c']);
    expect(db.prepare('SELECT count(*) FROM c').pluck().get()).toBe(0);
  });
});
