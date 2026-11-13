// Contract of the component `leveled` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it, so a new entry is checked
// without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import { type Leveled, lvlCost, sumLevels } from './leveled.ts';

const LEVELED = ENTRIES.flatMap(([key, e]) =>
  'leveled' in e ? [[key, e.leveled as Leveled] as const] : [],
);

describe('leveled: contract for every entry that has it', () => {
  it('is on every building and every research', () => {
    const kinds = ENTRIES.filter(([, e]) => 'leveled' in e).map(
      ([, e]) => e.kind,
    );
    expect(new Set(kinds)).toEqual(new Set(['building', 'research']));
    expect(LEVELED.length).toBe(
      ENTRIES.filter(([, e]) => e.kind === 'building' || e.kind === 'research')
        .length,
    );
  });

  it('gives every building its own factor and no research one (owner, #114)', () => {
    for (const [key, e] of ENTRIES) {
      if (e.kind === 'building') expect(e.leveled.f, key).toBeGreaterThan(1);
      if (e.kind === 'research') expect('f' in e.leveled, key).toBe(false);
    }
  });

  it.each(LEVELED)(
    '%s: costs whole non-negative amounts that never fall, levels 1 to 60',
    (_, leveled) => {
      let before = [0, 0, 0];
      for (let level = 1; level <= 60; level++) {
        const cost = lvlCost(leveled, level);
        expect(cost).toHaveLength(3);
        cost.forEach((x, i) => {
          expect(Number.isFinite(x)).toBe(true);
          expect(x).toBe(Math.floor(x));
          expect(x).toBeGreaterThanOrEqual(before[i]!);
        });
        before = [...cost];
      }
      expect(lvlCost(leveled, 1)).toEqual(leveled.cost);
      expect(Number.isFinite(sumLevels(leveled, 60))).toBe(true);
    },
  );
});

describe('leveled: the rule', () => {
  it('multiplies by f per level and rounds down; 2 without f', () => {
    expect(lvlCost({ cost: [10, 3, 1], f: 1.5 }, 3)).toEqual([22, 6, 2]);
    expect(lvlCost({ cost: [10, 3, 1] }, 3)).toEqual([40, 12, 4]);
    expect(lvlCost({ cost: [10, 3, 1] }, 1)).toEqual([10, 3, 1]);
  });

  it('adds up the cost of all levels', () => {
    expect(sumLevels({ cost: [10, 3, 1] }, 0)).toBe(0);
    expect(sumLevels({ cost: [10, 3, 1] }, 2)).toBe(14 + 28);
  });
});
