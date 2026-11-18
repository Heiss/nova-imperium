// Counter-espionage by the classic rules (#175): the chance of owiki
// „Spionagebericht“ in percent (owner, 2026-11-17), drawn up to its maximum.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MAX_CHANCE,
  PROBE_DIVISOR,
  SHIP_DIVISOR,
  SPY_MIN_TECH,
  counterChance,
  counterMax,
  detected,
  shownChance,
  spyTechError,
} from './espionage.ts';

const at = (probes: number, ships: number, target: number, spy: number) =>
  counterMax({ probes, ships, target, spy });

describe('counter-espionage (#175)', () => {
  it('spies only from espionage technology 1 (Q1)', () => {
    expect(SPY_MIN_TECH).toBe(1);
    expect(spyTechError(0)).toBe('noSpyTech');
    expect(spyTechError(-1)).toBe('noSpyTech');
    expect(spyTechError(1)).toBeUndefined();
    expect(spyTechError(12)).toBeUndefined();
  });

  it('names the numbers of the formula for the Lexicanum', () => {
    expect([PROBE_DIVISOR, SHIP_DIVISOR, MAX_CHANCE]).toEqual([4, 100, 100]);
  });

  it('is (probes / 4) · (target / spy) · (1 + ships / 100) percent', () => {
    expect(at(4, 0, 1, 1)).toBe(1);
    expect(at(1, 0, 1, 1)).toBe(0.25);
    expect(at(8, 0, 6, 3)).toBe(4);
    expect(at(4, 100, 1, 1)).toBe(2);
    expect(at(4, 50, 2, 1)).toBe(3);
    expect(at(10, 300, 5, 2)).toBe(25);
  });

  it('is at most 100 %', () => {
    expect(at(400, 0, 1, 1)).toBe(100);
    expect(at(100, 1000, 2, 1)).toBe(100);
    expect(at(399, 0, 1, 1)).toBe(99.75);
  });

  it('is 0 at a target of level 0 (Q1b) or without probes', () => {
    expect(at(1000, 10000, 0, 1)).toBe(0);
    expect(at(0, 10000, 10, 1)).toBe(0);
    expect(at(1000, 10000, 0, 0)).toBe(0);
  });

  it('is the cap for a spy below level 1, a fleet sent before Q1 [V]', () => {
    expect(at(1, 0, 1, 0)).toBe(100);
  });

  it('grows with probes, ships and the target tech, falls with the spy tech', () => {
    const n = fc.integer({ min: 1, max: 60 });
    fc.assert(
      fc.property(n, n, n, n, (probes, ships, target, spy) => {
        const base = at(probes, ships, target, spy);
        expect(base).toBeGreaterThan(0);
        expect(base).toBeLessThanOrEqual(100);
        expect(at(probes + 1, ships, target, spy)).toBeGreaterThanOrEqual(base);
        expect(at(probes, ships + 1, target, spy)).toBeGreaterThanOrEqual(base);
        expect(at(probes, ships, target + 1, spy)).toBeGreaterThanOrEqual(base);
        expect(at(probes, ships, target, spy + 1)).toBeLessThanOrEqual(base);
        if (base < 100)
          expect(at(probes + 1, ships, target, spy)).toBeGreaterThan(base);
      }),
      { seed: 175, numRuns: 300 },
    );
  });

  it('draws the chance from 0 up to the maximum (D2)', () => {
    expect(counterChance(40, () => 0)).toBe(0);
    expect(counterChance(40, () => 0.5)).toBe(20);
    expect(counterChance(40, () => 0.999)).toBeCloseTo(39.96);
    expect(counterChance(0, () => 0.7)).toBe(0);
  });

  it('detects the probes below the chance', () => {
    expect(detected(20, () => 0.19)).toBe(true);
    expect(detected(20, () => 0.2)).toBe(false);
    expect(detected(0, () => 0)).toBe(false);
    expect(detected(100, () => 0.999)).toBe(true);
  });

  it('shows the chance in whole percent, rounded', () => {
    expect(shownChance(0.25)).toBe(0);
    expect(shownChance(0.5)).toBe(1);
    expect(shownChance(14.49)).toBe(14);
    expect(shownChance(99.6)).toBe(100);
  });
});
