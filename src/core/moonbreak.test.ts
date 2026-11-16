// The rolls of the Mondbruch (#95; owner, 2026-11-13, owiki.de „Mond“):
// min(100, (100 − √d) · √n) % for the moon, √d / 2 % for the Weltenbrecher,
// two independent draws, the moon first.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seeded } from '../test/fixtures.ts';
import { breakChance, lossChance, moonbreak } from './moonbreak.ts';

/** A generator that returns the given draws in turn. */
const draws = (...xs: number[]): (() => number) => {
  let i = 0;
  return () => xs[i++]!;
};

describe('the chances of the Mondbruch', () => {
  it('gives the example of the owner: 4,000 km and one Weltenbrecher', () => {
    expect(breakChance(4000, 1)).toBeCloseTo(36.75, 2);
    expect(lossChance(4000)).toBeCloseTo(31.62, 2);
  });

  it('follows the formulas exactly', () => {
    expect(breakChance(3600, 1)).toBe(40);
    expect(breakChance(3600, 4)).toBe(80);
    expect(breakChance(6400, 9)).toBe(60);
    expect(breakChance(8100, 25)).toBe(50);
    expect(lossChance(3600)).toBe(30);
    expect(lossChance(8100)).toBe(45);
  });

  it('never gives the moon more than 100 %', () => {
    expect(breakChance(3600, 7)).toBe(100);
    expect(breakChance(2500, 4)).toBe(100);
    expect(breakChance(3600, 6.25)).toBe(100);
    expect(breakChance(0, 0)).toBe(0);
  });

  it('grows with the Weltenbrecher and falls with the diameter (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3605, max: 8944 }),
        fc.integer({ min: 1, max: 1000 }),
        (d, n) => {
          const c = breakChance(d, n);
          expect(c).toBeGreaterThan(0);
          expect(c).toBeLessThanOrEqual(100);
          expect(breakChance(d, n + 1)).toBeGreaterThanOrEqual(c);
          expect(breakChance(d + 1, n)).toBeLessThanOrEqual(c);
          expect(c).toBe(Math.min(100, (100 - Math.sqrt(d)) * Math.sqrt(n)));
          expect(lossChance(d)).toBe(Math.sqrt(d) / 2);
        },
      ),
      { seed: 95, numRuns: 300 },
    );
  });
});

describe('the rolls of the Mondbruch', () => {
  it('rolls the moon first, then the Weltenbrecher, one draw each', () => {
    // 3,600 km and one Weltenbrecher: 40 % and 30 %.
    expect(moonbreak(3600, 1, draws(0.39, 0.29))).toEqual({
      chance: 40,
      broken: true,
      loss: 30,
      lost: true,
    });
    expect(moonbreak(3600, 1, draws(0.4, 0.3))).toEqual({
      chance: 40,
      broken: false,
      loss: 30,
      lost: false,
    });
    expect(moonbreak(3600, 1, draws(0.39, 0.3))).toMatchObject({
      broken: true,
      lost: false,
    });
    expect(moonbreak(3600, 1, draws(0.4, 0.29))).toMatchObject({
      broken: false,
      lost: true,
    });
  });

  it('always breaks at 100 % and never at 0 %', () => {
    expect(moonbreak(3600, 7, draws(0.999999, 0.5)).broken).toBe(true);
    expect(moonbreak(3600, 0, draws(0, 0.5)).broken).toBe(false);
  });

  it('hits as often as the chances say, independently (seeded)', () => {
    const rng = seeded(95);
    const runs = 20000;
    let broken = 0;
    let lost = 0;
    let both = 0;
    for (let i = 0; i < runs; i++) {
      const r = moonbreak(4000, 1, rng);
      broken += Number(r.broken);
      lost += Number(r.lost);
      both += Number(r.broken && r.lost);
    }
    expect(broken / runs).toBeCloseTo(0.3675, 1);
    expect(lost / runs).toBeCloseTo(0.3162, 1);
    expect(both / runs).toBeCloseTo(0.3675 * 0.3162, 1);
  });

  it('takes exactly two draws (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3605, max: 8944 }),
        fc.integer({ min: 1, max: 50 }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        fc.double({ min: 0, max: 0.999, noNaN: true }),
        (d, n, a, b) => {
          let calls = 0;
          const rng = () => [a, b][calls++]!;
          const r = moonbreak(d, n, rng);
          expect(calls).toBe(2);
          expect(r.broken).toBe(a < r.chance / 100);
          expect(r.lost).toBe(b < r.loss / 100);
        },
      ),
      { seed: 95, numRuns: 300 },
    );
  });
});
