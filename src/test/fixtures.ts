// Builders for test data. Not part of the measured code.
import { storedValues } from '../core/round.ts';
import { DEFAULT_UNIVERSE } from '../core/universe.ts';
import type { Planet, Universe } from '../core/types.ts';

export const U: Universe = { ...DEFAULT_UNIVERSE };

/**
 * The value of every setting of a round at its default, by name (#310): the
 * fixture of a test that needs a full set of values, so a new setting needs
 * no edit in the tests of other features. A test names the values of its own
 * feature on top of it: `{ ...roundDefaults(), guilds: false }`.
 */
export const roundDefaults = (): Record<string, number | boolean> =>
  storedValues(() => undefined);

export function planet(over: Partial<Planet> = {}): Planet {
  return {
    id: 'p1_1_5',
    kind: 'planet',
    owner: 'u1',
    name: 'Heimat',
    g: 1,
    s: 1,
    p: 5,
    temp: 50,
    diameter: 12800,
    unlimited: false,
    res: { m: 500, c: 500, d: 0 },
    b: {},
    ships: {},
    def: {},
    bq: null,
    sq: [],
    sqT: null,
    pct: {},
    t: 0,
    created: 0,
    ...over,
  };
}

/** A deterministic random number generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the values of the list in turn (for exact battle tests). */
export function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}
