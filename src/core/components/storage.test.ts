// Contract of the component `storage` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it.
import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { ENTRIES } from '../../features/index.gen.ts';
import { capacities, capOf, type Storage } from './storage.ts';

const STORES = ENTRIES.flatMap(([key, e]) =>
  'storage' in e ? [{ key, storage: e.storage as Storage }] : [],
);

describe('storage: contract for every entry that has it', () => {
  it('raises Adamant, Psikristall or Promethium, each by at most one entry', () => {
    const res = STORES.map((s) => s.storage.res);
    for (const r of res) expect(['m', 'c', 'd']).toContain(r);
    expect(new Set(res).size).toBe(res.length);
  });

  it.each(STORES)(
    '$key: the limit starts at the base and grows with every level up to 60',
    ({ key, storage }) => {
      expect(capacities(STORES, {}, U)[storage.res]).toBe(U.baseStore);
      let before = U.baseStore;
      for (let level = 1; level <= 60; level++) {
        const cap = capacities(STORES, { [key]: level }, U)[storage.res];
        expect(Number.isFinite(cap)).toBe(true);
        expect(cap).toBeGreaterThan(before);
        before = cap;
      }
    },
  );
});

describe('storage: the rule', () => {
  it('starts at the base value and grows with 1.6^level', () => {
    expect(capOf(0, U)).toBe(100000);
    expect(capOf(2, U)).toBe(100000 + 50000 * 2);
  });

  it('reads each limit from the level of the store of its resource', () => {
    const stores = [
      { key: 'a', storage: { res: 'c' } },
      { key: 'b', storage: { res: 'd' } },
    ] as const;
    expect(capacities(stores, { a: 1, b: 3, x: 9 }, U)).toEqual({
      m: capOf(0, U),
      c: capOf(1, U),
      d: capOf(3, U),
    });
    expect(capacities([], { a: 5 }, { ...U, baseStore: 7 })).toEqual({
      m: 7,
      c: 7,
      d: 7,
    });
  });
});
