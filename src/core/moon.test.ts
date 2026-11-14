// Moons (#53, okf/features/moons.md): the chance from the whole Trümmerfeld,
// its roll, the diameter by the owiki.de formula and the shown name.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  formsMoon,
  MAX_MOON_CHANCE,
  moonChance,
  moonDiameter,
  placeName,
} from './moon.ts';

/** A random generator that returns the given draws in turn. */
const draws = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++]!;
};

describe('moon chance', () => {
  it('is 1 % per 100,000 Adamant and Psikristall, rounded down', () => {
    expect(moonChance({ m: 0, c: 0 })).toBe(0);
    expect(moonChance({ m: 99999, c: 0 })).toBe(0);
    expect(moonChance({ m: 99999.5, c: 0.5 })).toBe(1);
    expect(moonChance({ m: 50000, c: 50000 })).toBe(1);
    expect(moonChance({ m: 0, c: 199999 })).toBe(1);
    expect(moonChance({ m: 700000, c: 549999 })).toBe(12);
  });

  it('is at most 20 %, from 2,000,000 on', () => {
    expect(MAX_MOON_CHANCE).toBe(20);
    expect(moonChance({ m: 1999999, c: 0 })).toBe(19);
    expect(moonChance({ m: 1000000, c: 1000000 })).toBe(20);
    expect(moonChance({ m: 9e9, c: 9e9 })).toBe(20);
  });

  it('is a whole number from 0 to 20 for any field', () => {
    const amount = fc.double({ min: 0, max: 1e9, noNaN: true });
    fc.assert(
      fc.property(amount, amount, (m, c) => {
        const x = moonChance({ m, c });
        expect(Number.isInteger(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(20);
      }),
    );
  });
});

describe('moon roll', () => {
  it('forms a moon when one draw falls below the chance', () => {
    expect(formsMoon(20, () => 0)).toBe(true);
    expect(formsMoon(20, () => 0.1999)).toBe(true);
    expect(formsMoon(20, () => 0.2)).toBe(false);
    expect(formsMoon(1, () => 0.0099)).toBe(true);
    expect(formsMoon(1, () => 0.01)).toBe(false);
    expect(formsMoon(0, () => 0)).toBe(false);
  });

  it('takes exactly one draw', () => {
    let n = 0;
    formsMoon(10, () => (n++, 0.5));
    expect(n).toBe(1);
  });
});

describe('moon diameter', () => {
  it('is ⌊√(x + 3 · chance) · 1000⌋ km with x from 10 to 20', () => {
    // x = 10 + ⌊draw · 11⌋
    expect(moonDiameter(1, () => 0)).toBe(3605);
    expect(moonDiameter(20, () => 0.9999)).toBe(8944);
    expect(moonDiameter(20, () => 0)).toBe(Math.floor(Math.sqrt(70) * 1000));
    expect(moonDiameter(5, () => 0.5)).toBe(Math.floor(Math.sqrt(30) * 1000));
    expect(moonDiameter(5, () => 0.0909)).toBe(
      Math.floor(Math.sqrt(25) * 1000),
    );
    expect(moonDiameter(5, () => 0.091)).toBe(Math.floor(Math.sqrt(26) * 1000));
  });

  it('gives every x from 10 to 20 for equal parts of the draws', () => {
    const xs = new Set<number>();
    for (let i = 0; i < 11; i++) {
      const d = moonDiameter(0, draws((i + 0.5) / 11));
      xs.add(Math.round((d / 1000) ** 2));
    }
    expect([...xs]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('lies between 3,605 and 8,944 km for every chance of 1 to 20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (chance, draw) => {
          const d = moonDiameter(chance, () => draw);
          expect(Number.isInteger(d)).toBe(true);
          expect(d).toBeGreaterThanOrEqual(3605);
          expect(d).toBeLessThanOrEqual(8944);
        },
      ),
    );
  });
});

describe('the name of a place', () => {
  it('shows a moon as „<Name> (Mond)“ and a planet by its name', () => {
    expect(placeName({ name: 'Mond', kind: 'moon' })).toBe('Mond (Mond)');
    expect(placeName({ name: 'Luna', kind: 'moon' })).toBe('Luna (Mond)');
    expect(placeName({ name: 'Heimat', kind: 'planet' })).toBe('Heimat');
  });
});
