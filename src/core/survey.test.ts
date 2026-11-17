// Surveying a free position (#190): the score and its tiers, the loss, the
// values of a new planet and what each tier of the report shows.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seeded } from '../test/fixtures.ts';
import { colonyDiameter, fieldRange, fieldsOf } from './fields.ts';
import { distance } from './flight.ts';
import { satEnergy, tempFactor } from './rates.ts';
import {
  CENTRED,
  MAX_LOSS,
  SURVEY_DAYS,
  SIZE_FIELDS,
  maxLoss,
  nearShift,
  orbitOf,
  positionTemp,
  rollTemp,
  sizeOf,
  surveyFindings,
  surveyLost,
  surveyScore,
  surveyTier,
} from './survey.ts';

describe('the score of a survey (D2)', () => {
  it('is probes + 2 · level', () => {
    expect(surveyScore(1, 0)).toBe(1);
    expect(surveyScore(3, 2)).toBe(7);
    expect(surveyScore(8, 1)).toBe(10);
  });

  it('shows rough below 4, near from 4, exact from 7, full from 10', () => {
    expect([0, 3, 4, 6, 7, 9, 10, 40].map(surveyTier)).toEqual([
      'rough',
      'rough',
      'near',
      'near',
      'exact',
      'exact',
      'full',
      'full',
    ]);
  });

  it('needs the probes of the owner table for a full report per level', () => {
    // Level 1: 8, level 2: 6, level 3: 4, level 4: 2, level 5: 1 (owner, 2026-11-14).
    for (const [level, probes] of [
      [1, 8],
      [2, 6],
      [3, 4],
      [4, 2],
      [5, 1],
    ] as const) {
      expect(surveyTier(surveyScore(probes, level)), `${level}`).toBe('full');
      if (probes > 1)
        expect(surveyTier(surveyScore(probes - 1, level))).not.toBe('full');
    }
  });
});

describe('the loss of a survey (D2)', () => {
  const same = distance({ g: 1, s: 1, p: 5 }, { g: 1, s: 1, p: 9 });
  const tenSystems = distance({ g: 1, s: 1, p: 5 }, { g: 1, s: 11, p: 5 });
  const galaxy = distance({ g: 1, s: 1, p: 5 }, { g: 2, s: 1, p: 5 });
  const twoGalaxies = distance({ g: 1, s: 1, p: 5 }, { g: 3, s: 1, p: 5 });
  const pct = (x: number): number => Math.round(x * 100);

  it('matches the table of the owner (revision 2, in %)', () => {
    const rows = [
      [1, 8],
      [2, 6],
      [3, 4],
      [4, 2],
      [5, 1],
    ] as const;
    expect(
      rows.map(([level, probes]) =>
        [same, tenSystems, galaxy, twoGalaxies].map((d) =>
          pct(maxLoss(probes, level, d)),
        ),
      ),
    ).toEqual([
      [44, 52, 60, 60],
      [18, 24, 52, 60],
      [9, 14, 37, 59],
      [5, 9, 28, 47],
      [3, 7, 23, 39],
    ]);
  });

  it('computes the formula exactly and never above 60 %', () => {
    expect(maxLoss(2, 1, 1000)).toBeCloseTo(0.1 + 0.06 / 1.4, 12);
    expect(maxLoss(4, 2, 5)).toBeCloseTo(
      0.1 + (0.06 * Math.pow(0.005, 0.8)) / 1.8,
      12,
    );
    expect(maxLoss(100, 1, 0)).toBe(MAX_LOSS);
    expect(maxLoss(1, 0, 5)).toBe(MAX_LOSS);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 5, max: 200000 }),
        (probes, level, d) => {
          const x = maxLoss(probes, level, d);
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThanOrEqual(MAX_LOSS);
          // More probes and more distance raise it, research lowers it.
          expect(maxLoss(probes + 1, level, d)).toBeGreaterThanOrEqual(x);
          expect(maxLoss(probes, level, d + 1000)).toBeGreaterThanOrEqual(x);
          expect(maxLoss(probes, level + 1, d)).toBeLessThanOrEqual(x);
        },
      ),
    );
  });

  it('draws the chance between 0 and the maximum, then rolls once', () => {
    const draws = (...xs: number[]) => {
      const queue = [...xs];
      return () => queue.shift()!;
    };
    // The chance 0.5 · 0.4 = 0.2; a roll below it loses the probes.
    expect(surveyLost(0.4, draws(0.5, 0.19))).toBe(true);
    expect(surveyLost(0.4, draws(0.5, 0.2))).toBe(false);
    expect(surveyLost(0, draws(0.99, 0))).toBe(false);
    // On average half of the maximum is lost.
    const rng = seeded(190);
    let lost = 0;
    for (let i = 0; i < 20000; i++) if (surveyLost(0.4, rng)) lost++;
    expect(lost / 20000).toBeCloseTo(0.2, 1);
  });
});

describe('the values of a free position (D1)', () => {
  it('rolls the temperature as a colony did: 130 − (p − 1) · 10 ± 10', () => {
    expect(positionTemp(1)).toBe(130);
    expect(positionTemp(9)).toBe(50);
    expect(positionTemp(15)).toBe(-10);
    expect(rollTemp(9, () => 0)).toBe(40);
    expect(rollTemp(9, () => 0.5)).toBe(50);
    expect(rollTemp(9, () => 0.999)).toBe(60);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (p, r) => {
          expect(rollTemp(p, () => r)).toBe(
            Math.round(130 - (p - 1) * 10 + (r * 20 - 10)),
          );
        },
      ),
    );
  });

  it('keeps 30 days', () => {
    expect(SURVEY_DAYS).toBe(30);
  });
});

describe('the words of the rough report (D5, owner, 2026-11-17)', () => {
  it('names the classic orbits: 1–3 inner, 4–12 middle, 13–15 outer', () => {
    const bands = Array.from({ length: 15 }, (_, i) => orbitOf(i + 1, 15));
    expect(bands).toEqual([
      ...Array(3).fill('inner'),
      ...Array(9).fill('middle'),
      ...Array(3).fill('outer'),
    ]);
    // Fewer positions keep the classic bands.
    expect([3, 4, 12].map((p) => orbitOf(p, 12))).toEqual([
      'inner',
      'middle',
      'middle',
    ]);
  });

  it('scales the bands with more than 15 positions [V]', () => {
    const bands = (n: number) =>
      Array.from({ length: n }, (_, i) => orbitOf(i + 1, n));
    expect(bands(16)).toEqual([
      ...Array(3).fill('inner'),
      ...Array(9).fill('middle'),
      ...Array(4).fill('outer'),
    ]);
    expect(bands(20)).toEqual([
      ...Array(4).fill('inner'),
      ...Array(12).fill('middle'),
      ...Array(4).fill('outer'),
    ]);
  });

  it('keeps the bands in order, a fifth inner and outer, for every size (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 20 }),
        fc.integer({ min: 1, max: 19 }),
        (n, p) => {
          const rank = { inner: 0, middle: 1, outer: 2 } as const;
          expect(rank[orbitOf(p, n)]).toBeLessThanOrEqual(
            rank[orbitOf(p + 1, n)],
          );
          const m = Math.max(n, 15);
          expect(orbitOf(p, n) === 'inner').toBe(p <= m / 5);
          expect(orbitOf(p, n) === 'outer').toBe(p > (4 * m) / 5);
        },
      ),
    );
  });

  it('divides the fields 96–252 into thirds, each with its lower end', () => {
    expect(SIZE_FIELDS).toEqual({ min: 96, max: 252 });
    expect([90, 147.9, 148, 199.9, 200, 252, 260].map(sizeOf)).toEqual([
      'small',
      'small',
      'medium',
      'medium',
      'large',
      'large',
      'large',
    ]);
  });

  it('guesses the size from the average fields of the position [V]', () => {
    const size = (p: number) =>
      surveyFindings(
        { s: 1, p, positions: 20 },
        { temp: 0, diameter: 1 },
        'rough',
        CENTRED,
      ).size;
    expect(Array.from({ length: 16 }, (_, i) => size(i + 1))).toEqual([
      'small',
      'small',
      'small',
      'medium',
      'medium',
      'medium',
      'large',
      'large',
      'medium',
      'medium',
      'medium',
      'medium',
      'small',
      'small',
      'small',
      'small',
    ]);
  });
});

describe('what a survey report shows', () => {
  // Position 9 of an odd system: a Dschungelplanet, 150–246 fields.
  const c = { s: 42, p: 9, positions: 15 };
  const values = { temp: 72, diameter: 14600 };

  it('shows what the position lets one guess in the rough report (D5)', () => {
    expect(surveyFindings(c, values, 'rough', CENTRED)).toEqual({
      tier: 'rough',
      planetType: 'dschungel',
      range: { min: 150, max: 246 },
      average: 198,
      around: 50,
      orbit: 'middle',
      size: 'medium',
    });
  });

  it('shifts each window at random, keeping its width, the true value inside (owner, 2026-11-17)', () => {
    const near = (fields: number, temp: number) =>
      surveyFindings(c, values, 'near', { fields, temp });
    // 213 fields ± 20 % is a window of 85.2 fields, the temperature 20 °C.
    expect(near(0, 0)).toMatchObject({
      fields: { min: 213, max: 298 },
      temp: { min: 72, max: 92 },
    });
    expect(near(0.25, 0.75)).toMatchObject({
      fields: { min: 192, max: 277 },
      temp: { min: 57, max: 77 },
    });
    expect(near(0.9999, 0.9999)).toMatchObject({
      fields: { min: 128, max: 213 },
      temp: { min: 52, max: 72 },
    });
    // Only the windows of score 4 move.
    for (const tier of ['rough', 'exact', 'full'] as const)
      expect(surveyFindings(c, values, tier, { fields: 0, temp: 1 })).toEqual(
        surveyFindings(c, values, tier, CENTRED),
      );
  });

  it('draws the shift once per window, only for score 4', () => {
    const draws = [0.1, 0.8, 0.3];
    const rng = () => draws.shift()!;
    expect(nearShift('near', rng)).toEqual({ fields: 0.1, temp: 0.8 });
    for (const tier of ['rough', 'exact', 'full'] as const)
      expect(nearShift(tier, rng)).toEqual(CENTRED);
    expect(draws).toEqual([0.3]);
    expect(CENTRED).toEqual({ fields: 0.5, temp: 0.5 });
  });

  it('keeps the true value inside a window of its width for every shift (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (p, seed, fields, temp) => {
          const rng = seeded(seed);
          const v = {
            temp: rollTemp(p, rng),
            diameter: colonyDiameter(p, rng),
          };
          const f = fieldsOf(v.diameter);
          const x = surveyFindings({ s: 1, p, positions: 15 }, v, 'near', {
            fields,
            temp,
          });
          expect(x.fields!.min).toBeLessThanOrEqual(f);
          expect(x.fields!.max).toBeGreaterThanOrEqual(f);
          expect(x.temp!.min).toBeLessThanOrEqual(v.temp);
          expect(x.temp!.max).toBeGreaterThanOrEqual(v.temp);
          // The width stays 40 % of the fields and 20 °C, up to rounding.
          expect(
            Math.abs(x.fields!.max - x.fields!.min - 0.4 * f),
          ).toBeLessThanOrEqual(1);
          expect(Math.abs(x.temp!.max - x.temp!.min - 20)).toBeLessThanOrEqual(
            1,
          );
        },
      ),
    );
  });

  it('narrows the fields to ± 20 % and the temperature to ± 10 °C (score 4)', () => {
    expect(fieldsOf(14600)).toBe(213);
    expect(surveyFindings(c, values, 'near', CENTRED)).toMatchObject({
      tier: 'near',
      fields: { min: 170, max: 256 },
      temp: { min: 62, max: 82 },
    });
    expect(surveyFindings(c, values, 'near', CENTRED)).not.toHaveProperty(
      'full',
    );
  });

  it('shows the exact fields and temperature (score 7)', () => {
    const x = surveyFindings(c, values, 'exact', CENTRED);
    expect(x).toMatchObject({
      fields: { min: 213, max: 213 },
      temp: { min: 72, max: 72 },
    });
    expect(x).not.toHaveProperty('full');
  });

  it('shows everything known in the full report (D6)', () => {
    expect(surveyFindings(c, values, 'full', CENTRED).full).toEqual({
      temp: 72,
      diameter: 14600,
      fields: 213,
      compare: 'above',
      factor: tempFactor(72),
      energy: 38,
      pros: ['manyFields', 'muchEnergy'],
      cons: ['weakFactor'],
    });
    expect(tempFactor(72)).toBeCloseTo(1.136, 12);
    expect(satEnergy(72)).toBe(38);
  });

  it('names the benefits and drawbacks against the position', () => {
    const full = (temp: number, diameter: number) =>
      surveyFindings(c, { temp, diameter }, 'full', CENTRED).full!;
    // Fewer fields than the average 198 and cooler than 50 °C.
    expect(full(40, 12000)).toMatchObject({
      fields: 144,
      compare: 'below',
      pros: ['goodFactor'],
      cons: ['fewFields', 'littleEnergy'],
    });
    // Exactly the average and the middle temperature: nothing to name.
    expect(full(50, 14072)).toMatchObject({
      fields: 198,
      compare: 'average',
      pros: [],
      cons: [],
    });
  });

  it('keeps the average of an odd range and uses the planet type of the coordinates', () => {
    const x = surveyFindings(
      { s: 2, p: 5, positions: 15 },
      values,
      'rough',
      CENTRED,
    );
    expect(x.range).toEqual(fieldRange(5));
    expect(x.average).toBe(182.5);
    expect(x.planetType).toBe('trocken');
  });

  it('shows ranges that hold the values of every possible planet', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 1, max: 499 }),
        fc.integer({ min: 0, max: 1000 }),
        (p, s, seed) => {
          const rng = seeded(seed);
          const v = {
            temp: rollTemp(p, rng),
            diameter: colonyDiameter(p, rng),
          };
          const f = fieldsOf(v.diameter);
          const near = surveyFindings(
            { s, p, positions: 15 },
            v,
            'near',
            CENTRED,
          );
          expect(near.fields!.min).toBeLessThanOrEqual(f);
          expect(near.fields!.max).toBeGreaterThanOrEqual(f);
          expect(near.temp).toEqual({ min: v.temp - 10, max: v.temp + 10 });
          const full = surveyFindings(
            { s, p, positions: 15 },
            v,
            'full',
            CENTRED,
          ).full!;
          expect(full.fields).toBe(f);
          expect(f).toBeGreaterThanOrEqual(near.range.min);
          expect(f).toBeLessThanOrEqual(near.range.max);
        },
      ),
    );
  });
});
