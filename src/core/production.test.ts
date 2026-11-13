// prod() from the components (#114) is bit-identical to prod() before: a
// property test on generated planets, including planets with a
// Fusionskraftwerk and Solarsatelliten, which the equivalence tests of
// version 1 do not cover (owner, 2026-11-13). The reference below is prod()
// as it was on main before #114, copied unchanged.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { U } from '../test/fixtures.ts';
import { prod } from './economy.ts';
import type { Levels, Planet, Universe } from './types.ts';

type ProdPlanet = Pick<Planet, 'b' | 'pct' | 'temp'> &
  Partial<Pick<Planet, 'ships'>>;

const lv = (levels: Levels, key: string): number => levels[key] ?? 0;
const growth = (l: number): number => l * Math.pow(1.1, l);
const satEnergy = (temp: number): number =>
  Math.max(0, Math.floor(temp / 4 + 20));
const satPower = (p: ProdPlanet): number =>
  ((p.ships?.sat ?? 0) * satEnergy(p.temp) * (p.pct.sat ?? 100)) / 100;
const fusionEnergy = (level: number, tech: number): number =>
  30 * level * Math.pow(1.05 + 0.01 * tech, level);
const fusionUse = (level: number, u: Universe): number =>
  10 * growth(level) * u.speed;

function reference(p: ProdPlanet, u: Universe, research: Levels = {}) {
  const g = (k: string): number => growth(lv(p.b, k));
  const pc = (k: string): number => (p.pct[k] ?? 100) / 100;
  const fusion = lv(p.b, 'fusion');
  const eProd =
    20 * g('solar') * pc('solar') +
    satPower(p) +
    fusionEnergy(fusion, lv(research, 'energy')) * pc('fusion');
  const eUse =
    10 * g('metal') * pc('metal') +
    10 * g('crystal') * pc('crystal') +
    20 * g('deut') * pc('deut');
  const f = eUse <= 0 ? 1 : Math.min(1, eProd / eUse);
  const sp = u.speed;
  return {
    m: (20 + 30 * g('metal') * pc('metal') * f) * sp,
    c: (10 + 20 * g('crystal') * pc('crystal') * f) * sp,
    d:
      Math.max(
        0,
        10 * g('deut') * (1.28 - 0.002 * (p.temp || 20)) * pc('deut') * f * sp,
      ) -
      fusionUse(fusion, u) * pc('fusion'),
    eProd,
    eUse,
    f,
  };
}

const PRODUCERS = ['metal', 'crystal', 'deut', 'solar', 'sat', 'fusion'];
const level = fc.integer({ min: 0, max: 45 });
/** Some of the levels of `keys`; a missing key is level 0. */
const levels = (keys: string[]): fc.Arbitrary<Levels> =>
  fc
    .record(Object.fromEntries(keys.map((k) => [k, level])), {
      requiredKeys: [],
    })
    .map((x) => x as Levels);

const planet = fc
  .record(
    {
      b: levels(['metal', 'crystal', 'deut', 'solar', 'fusion', 'robot']),
      ships: fc.record(
        { sat: fc.integer({ min: 0, max: 5000 }), lf: level },
        { requiredKeys: [] },
      ),
      pct: fc.record(
        Object.fromEntries(
          PRODUCERS.map((k) => [
            k,
            fc.oneof(
              fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
              fc.double({ min: 0, max: 100, noNaN: true }),
            ),
          ]),
        ),
        { requiredKeys: [] },
      ),
      temp: fc.integer({ min: -60, max: 180 }),
    },
    { requiredKeys: ['b', 'pct', 'temp'] },
  )
  .map((p) => p as ProdPlanet);
const universe = fc
  .oneof(
    fc.constant(1),
    fc.integer({ min: 1, max: 100 }),
    fc.double({ min: 0.5, max: 10, noNaN: true }),
  )
  .map((speed) => ({ ...U, speed }));
const research = fc.oneof(fc.constant(undefined), levels(['energy', 'laser']));

describe('prod() from the components', () => {
  it('is bit-identical to prod() before #114', () => {
    fc.assert(
      fc.property(planet, universe, research, (p, u, r) => {
        const now = prod(p, u, r);
        const before = reference(p, u, r);
        for (const k of ['m', 'c', 'd', 'eProd', 'eUse', 'f'] as const)
          expect(Object.is(now[k], before[k]), k).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });

  it('is bit-identical on planets with every producer built', () => {
    const full = fc.record({
      b: fc.record({
        metal: level,
        crystal: level,
        deut: level,
        solar: level,
        fusion: fc.integer({ min: 1, max: 45 }),
      }),
      ships: fc.record({ sat: fc.integer({ min: 1, max: 5000 }) }),
      pct: fc.constant({}),
      temp: fc.integer({ min: -60, max: 180 }),
    });
    fc.assert(
      fc.property(full, universe, levels(['energy']), (p, u, r) => {
        const now = prod(p, u, r);
        const before = reference(p, u, r);
        expect(now.eProd).toBeGreaterThan(0);
        for (const k of ['m', 'c', 'd', 'eProd', 'eUse', 'f'] as const)
          expect(Object.is(now[k], before[k]), k).toBe(true);
      }),
      { numRuns: 5000 },
    );
  });
});
