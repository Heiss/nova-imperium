// Contract of the components `silo` and `missile` (okf/architecture/
// patterns.md, section 12; #54): it runs for every entry that has one, so a
// new silo or missile is checked without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import {
  fits,
  type Missile,
  missilePlaces,
  type Silo,
  siloPlaces,
  strikes,
} from './silo.ts';

const SILOS = ENTRIES.flatMap(([key, e]) =>
  'silo' in e ? [[key, e.silo as Silo] as const] : [],
);
const MISSILES = ENTRIES.flatMap(([key, e]) =>
  'missile' in e ? [[key, e.missile as Missile] as const] : [],
);

describe('silo and missile: contract for every entry that has one', () => {
  it('puts a silo only on buildings and a missile only on defense', () => {
    expect(SILOS.length).toBeGreaterThan(0);
    expect(MISSILES.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES) {
      if ('silo' in e) expect(e.kind, key).toBe('building');
      if ('missile' in e) expect(e.kind, key).toBe('defense');
    }
  });

  it.each([...SILOS, ...MISSILES])(
    '%s: takes or gives a whole number of places, at least 1',
    (_, c) => {
      expect(Number.isInteger(c.slots)).toBe(true);
      expect(c.slots).toBeGreaterThanOrEqual(1);
    },
  );

  it('has exactly one missile that is launched and at least one that intercepts', () => {
    expect(MISSILES.filter(([, m]) => strikes(m))).toHaveLength(1);
    expect(MISSILES.filter(([, m]) => !strikes(m)).length).toBeGreaterThan(0);
  });

  it.each(MISSILES)(
    '%s: fits a whole number of pieces, never more than the free places allow',
    (_, m) => {
      fc.assert(
        fc.property(fc.integer({ min: -50, max: 1000 }), (free) => {
          const n = fits(m, free);
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n * m.slots).toBeLessThanOrEqual(Math.max(0, free));
          expect((n + 1) * m.slots).toBeGreaterThan(free);
        }),
      );
    },
  );
});

describe('silo and missile: the rules', () => {
  const silos: Record<string, Silo> = { a: { slots: 10 }, b: { slots: 3 } };
  const missiles: Record<string, Missile> = {
    x: { slots: 1, intercepts: true },
    y: { slots: 2 },
  };

  it('gives every level of every silo its places', () => {
    expect(siloPlaces(silos, {})).toBe(0);
    expect(siloPlaces(silos, { a: 1 })).toBe(10);
    expect(siloPlaces(silos, { a: 4, b: 2, c: 9 })).toBe(46);
  });

  it('takes the places of every missile, other units take none', () => {
    expect(missilePlaces(missiles, {})).toBe(0);
    expect(missilePlaces(missiles, { x: 3 })).toBe(3);
    expect(missilePlaces(missiles, { x: 3, y: 4, rl: 100 })).toBe(11);
  });

  it('fits as many whole missiles as the free places hold', () => {
    expect(fits(missiles.x, 7)).toBe(7);
    expect(fits(missiles.y, 7)).toBe(3);
    expect(fits(missiles.y, 1)).toBe(0);
    expect(fits(missiles.y, 0)).toBe(0);
    expect(fits(missiles.x, -4)).toBe(0);
    expect(fits(undefined, 0)).toBe(Infinity);
  });

  it('launches a missile that does not intercept', () => {
    expect(strikes(missiles.y!)).toBe(true);
    expect(strikes(missiles.x!)).toBe(false);
  });
});
