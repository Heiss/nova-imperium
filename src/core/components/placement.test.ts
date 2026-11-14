// Contract of the component `placement` (okf/architecture/patterns.md,
// section 12; #53): it runs for every entry that has it, so a new building
// for moons is checked without new test code.
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import { PLANET_ONLY, type Placement, placeable } from './placement.ts';

const PLACEMENTS = ENTRIES.flatMap(([key, e]) =>
  'placement' in e ? [[key, e.placement as Placement] as const] : [],
);

const KINDS = ['planet', 'moon'] as const;

describe('placement: contract for every entry that has it', () => {
  it('is only on buildings, the entries that stand on a place', () => {
    expect(PLACEMENTS.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES)
      if ('placement' in e) expect(e.kind, key).toBe('building');
  });

  it.each(PLACEMENTS)(
    '%s: names known kinds of place, each once, at least one',
    (_, p) => {
      expect(p.length).toBeGreaterThan(0);
      expect(new Set(p).size).toBe(p.length);
      for (const kind of p) expect(KINDS).toContain(kind);
    },
  );
});

describe('placement: the rule', () => {
  it('without the component: planets only', () => {
    expect(PLANET_ONLY).toEqual(['planet']);
    expect(placeable(undefined, 'planet')).toBe(true);
    expect(placeable(undefined, 'moon')).toBe(false);
  });

  it('with the component: exactly the kinds it names', () => {
    expect(placeable(['moon'], 'moon')).toBe(true);
    expect(placeable(['moon'], 'planet')).toBe(false);
    expect(placeable(['planet', 'moon'], 'planet')).toBe(true);
    expect(placeable(['planet', 'moon'], 'moon')).toBe(true);
    expect(placeable(['planet'], 'moon')).toBe(false);
  });
});
