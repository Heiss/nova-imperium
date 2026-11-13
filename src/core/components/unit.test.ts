// Contract of the component `unit` (okf/architecture/patterns.md, section 12;
// #114): it runs for every entry that has it, so a new ship or defense is
// checked without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import type { Unit } from './unit.ts';

const UNITS = ENTRIES.flatMap(([key, e]) =>
  'unit' in e ? [[key, e.unit as Unit] as const] : [],
);

describe('unit: contract for every entry that has it', () => {
  it('is on every ship and every defense, and on nothing else', () => {
    const kinds = ENTRIES.filter(([, e]) => 'unit' in e).map(([, e]) => e.kind);
    expect(new Set(kinds)).toEqual(new Set(['ship', 'defense']));
    expect(UNITS.length).toBe(
      ENTRIES.filter(([, e]) => e.kind === 'ship' || e.kind === 'defense')
        .length,
    );
  });

  it.each(UNITS)(
    '%s: one piece costs whole resources, never below 0 and not nothing',
    (_, unit) => {
      expect(unit.cost).toHaveLength(3);
      for (const x of unit.cost) {
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
      }
      expect(unit.cost[0] + unit.cost[1] + unit.cost[2]).toBeGreaterThan(0);
    },
  );
});
