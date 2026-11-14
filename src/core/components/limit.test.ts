// Contract of the component `limit` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it, so a new limited unit is
// checked without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import { type Limit, room } from './limit.ts';

const LIMITS = ENTRIES.flatMap(([key, e]) =>
  'limit' in e ? [[key, e.limit as Limit] as const] : [],
);

/** Pieces on the planet or in the queue: none or some. */
const pieces = fc.integer({ min: 0, max: 1000 });

describe('limit: contract for every entry that has it', () => {
  it('is only on defense, the units yard.ts counts in the stock', () => {
    expect(LIMITS.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES)
      if ('limit' in e) expect(e.kind, key).toBe('defense');
  });

  it.each(LIMITS)('%s: allows a whole number of pieces, at least 1', (_, l) => {
    expect(Number.isInteger(l.perPlanet)).toBe(true);
    expect(l.perPlanet).toBeGreaterThanOrEqual(1);
  });

  it.each(LIMITS)(
    '%s: leaves a whole room between 0 and the limit, all of it on an empty planet',
    (_, l) => {
      expect(room(l, 0, 0)).toBe(l.perPlanet);
      fc.assert(
        fc.property(pieces, pieces, (have, queued) => {
          const r = room(l, have, queued);
          expect(Number.isInteger(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(l.perPlanet);
        }),
      );
    },
  );
});

describe('limit: the rule', () => {
  const three: Limit = { perPlanet: 3 };

  it('subtracts the pieces on the planet and those in the queue', () => {
    expect(room(three, 0, 0)).toBe(3);
    expect(room(three, 1, 0)).toBe(2);
    expect(room(three, 0, 2)).toBe(1);
    expect(room(three, 1, 1)).toBe(1);
    expect(room(three, 2, 1)).toBe(0);
  });

  it('never leaves a negative room', () => {
    expect(room(three, 5, 0)).toBe(0);
    expect(room(three, 0, 4)).toBe(0);
    expect(room({ perPlanet: 1 }, 1, 1)).toBe(0);
  });

  it('leaves an entry without limit unbounded', () => {
    expect(room(undefined, 0, 0)).toBe(Infinity);
    expect(room(undefined, 7, 9)).toBe(Infinity);
  });
});
