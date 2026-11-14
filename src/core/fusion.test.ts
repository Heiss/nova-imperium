// The Fusionskraftwerk (#47): energy with Energietechnik, deuterium use with
// the universe speed, its share, and the throttling at an empty stock (D1).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import {
  accrue,
  balancedShare,
  caps,
  fusionEnergy,
  fusionUse,
  prod,
  production,
  satEnergy,
  throttle,
} from './economy.ts';
import { settle } from './settle.ts';
import type { Levels, Planet, ResearchState, Universe } from './types.ts';

const H = 3600000;
const g = (l: number): number => l * Math.pow(1.1, l);
const at = (p: Planet, share: number): Planet => ({
  ...p,
  pct: { ...p.pct, fusion: share },
});
/** The Fusionskraftwerk as the consumer of the deuterium stock (#115). */
const REACTOR = { key: 'fusion', res: 'd' } as const;
/** The share the reactor is throttled to, or null when it runs at its set share. */
const fusionThrottle = (p: Planet, u: Universe, r: Levels): number | null => {
  const t = throttle(p, u, r);
  if (t === null) return null;
  expect(t).toEqual({ ...REACTOR, share: t.share });
  return t.share;
};
/** Net deuterium per hour with the reactor at `share` %. */
const net = (p: Planet, share: number, r: Levels): number =>
  prod(at(p, share), U, r).d;

describe('Fusionskraftwerk formulas (#47)', () => {
  it('gives 30 · F · (1.05 + 0.01 · T)^F energy', () => {
    expect(fusionEnergy(0, 7)).toBe(0);
    expect(fusionEnergy(1, 0)).toBeCloseTo(31.5, 12);
    expect(fusionEnergy(10, 3)).toBeCloseTo(300 * Math.pow(1.08, 10), 9);
    expect(fusionEnergy(5, 10)).toBeCloseTo(150 * Math.pow(1.15, 5), 9);
  });
  it('uses 10 · F · 1.1^F deuterium per hour times the universe speed', () => {
    expect(fusionUse(0, U)).toBe(0);
    expect(fusionUse(1, { ...U, speed: 1 })).toBeCloseTo(11, 12);
    expect(fusionUse(5, U)).toBeCloseTo(50 * Math.pow(1.1, 5) * U.speed, 9);
    expect(fusionUse(5, { ...U, speed: 2 })).toBeCloseTo(
      100 * Math.pow(1.1, 5),
      9,
    );
  });
});

describe('production with a Fusionskraftwerk (#47)', () => {
  const p = planet({
    b: { deut: 5, fusion: 2 },
    temp: 20,
    res: { m: 0, c: 0, d: 1000 },
  });
  it('adds its energy with Energietechnik and takes its use from the deuterium', () => {
    const pr = prod(p, U, { energy: 3 });
    const e = 60 * 1.08 * 1.08;
    expect(pr.eProd).toBeCloseTo(e, 10);
    expect(pr.eUse).toBeCloseTo(20 * g(5), 10);
    expect(pr.f).toBeCloseTo(e / (20 * g(5)), 10);
    const mine = 10 * g(5) * (1.28 - 0.04) * pr.f * U.speed;
    expect(pr.d).toBeCloseTo(mine - 10 * g(2) * U.speed, 9);
    // Without research Energietechnik counts as 0.
    expect(prod(p, U).eProd).toBeCloseTo(60 * 1.05 * 1.05, 10);
    expect(prod(p, U, { energy: 3, laser: 9 })).toEqual(pr);
  });
  it('applies its share to energy and use alike', () => {
    const half = prod({ ...p, pct: { fusion: 50 } }, U, { energy: 3 });
    const e = 30 * 1.08 * 1.08;
    expect(half.eProd).toBeCloseTo(e, 10);
    const mine = 10 * g(5) * (1.28 - 0.04) * half.f * U.speed;
    expect(half.d).toBeCloseTo(mine - 5 * g(2) * U.speed, 9);
    const off = prod({ ...p, pct: { fusion: 0 } }, U, { energy: 3 });
    expect(off.eProd).toBe(0);
    expect(off.d).toBe(0);
  });
  it('multiplies the use by the universe speed', () => {
    const many = planet({ b: { fusion: 4 } });
    expect(prod(many, { ...U, speed: 1 }).d).toBeCloseTo(-10 * g(4), 9);
    expect(prod(many, { ...U, speed: 3 }).d).toBeCloseTo(-30 * g(4), 9);
  });
  it('changes nothing without a Fusionskraftwerk', () => {
    const plain = planet({
      b: { metal: 7, crystal: 5, deut: 5, solar: 6 },
      temp: 33,
      ships: { sat: 3 },
      pct: { metal: 70, sat: 40, fusion: 30 },
    });
    expect(prod(plain, U, { energy: 12 })).toEqual(prod(plain, U));
  });
  it('adds solar, satellites and fusion together', () => {
    const all = planet({
      b: { solar: 4, fusion: 3, metal: 9 },
      temp: 40,
      ships: { sat: 5 },
      pct: { solar: 80, sat: 60, fusion: 70 },
    });
    const pr = prod(all, U, { energy: 5 });
    const want =
      20 * g(4) * 0.8 +
      (5 * satEnergy(40) * 60) / 100 +
      90 * Math.pow(1.1, 3) * 0.7;
    expect(pr.eProd).toBeCloseTo(want, 9);
    expect(pr.f).toBeCloseTo(Math.min(1, want / (10 * g(9))), 10);
  });
});

describe('throttling at an empty deuterium stock (#47 D1)', () => {
  // Deuterium 5 makes about 499 per hour; the reactor 8 wants about 857.
  const r = { energy: 3 };
  const dry = planet({
    b: { deut: 5, fusion: 8 },
    temp: 20,
    res: { m: 0, c: 0, d: 0 },
  });
  it('runs at the share where use equals production', () => {
    const s = fusionThrottle(dry, U, r)!;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(100);
    // f is 1 there: production 10 · g(5) · 1.24 · 5, use 10 · g(8) · s · 5.
    expect(s / 100).toBeCloseTo((g(5) * 1.24) / g(8), 12);
    expect(net(dry, s, r)).toBeGreaterThanOrEqual(0);
    expect(net(dry, s, r)).toBeLessThan(1e-9);
    expect(net(dry, s * (1 + 1e-12), r)).toBeLessThan(0);
  });
  it('finds the fixed point through the mine factor', () => {
    // The metal mine keeps f below 1 at the crossing: the reactor's own
    // energy raises the deuterium production it burns.
    const p = planet({
      b: { deut: 5, fusion: 8, metal: 10, solar: 5 },
      temp: 20,
      res: { m: 0, c: 0, d: 0 },
    });
    const s = fusionThrottle(p, U, r)!;
    const thr = prod(at(p, s), U, r);
    expect(thr.f).toBeLessThan(1);
    expect(thr.f).toBeGreaterThan(prod(at(p, 0), U, r).f);
    // Closed form below the kink of f: k · (a + b·s) / c = use · s.
    const k = 10 * g(5) * 1.24 * U.speed;
    const a = 20 * g(5);
    const b = fusionEnergy(8, 3) / 100;
    const c = 10 * g(10) + 20 * g(5);
    const use = fusionUse(8, U) / 100;
    expect(s).toBeCloseTo((k * a) / c / (use - (k * b) / c), 9);
    expect(Math.abs(net(p, s, r))).toBeLessThan(1e-9);
  });
  it('has one crossing: above it the stock would fall, below it not', () => {
    const s = balancedShare(dry, U, r, REACTOR);
    for (let x = 0; x <= 100; x += 2.5)
      if (x <= s) expect(net(dry, x, r)).toBeGreaterThanOrEqual(0);
      else expect(net(dry, x, r)).toBeLessThan(0);
  });
  it('grows with the deuterium production and shrinks with the reactor', () => {
    // Deuterium 8 would already feed the whole reactor.
    const shares = [5, 6, 7].map((deut) =>
      balancedShare({ ...dry, b: { deut, fusion: 8 } }, U, r, REACTOR),
    );
    for (let i = 1; i < shares.length; i++)
      expect(shares[i]!).toBeGreaterThan(shares[i - 1]!);
    const bigger = [8, 9, 10, 11].map((fusion) =>
      balancedShare({ ...dry, b: { deut: 5, fusion } }, U, r, REACTOR),
    );
    for (let i = 1; i < bigger.length; i++)
      expect(bigger[i]!).toBeLessThan(bigger[i - 1]!);
  });
  it('stays below the set share and stops when nothing is produced', () => {
    const set = at(dry, 70);
    const s = fusionThrottle(set, U, r)!;
    expect(s).toBeCloseTo(fusionThrottle(dry, U, r)!, 12);
    expect(fusionThrottle(at(dry, 50), U, r)).toBeNull();
    const none = planet({ b: { fusion: 3 }, res: { m: 0, c: 0, d: 0 } });
    expect(fusionThrottle(none, U, r)).toBeCloseTo(0, 300);
    expect(production(none, U, r)).toEqual({
      ...prod(none, U, r),
      d: 0,
      eProd: 0,
    });
  });
  it('does not throttle an empty stock whose net deuterium is exactly 0', () => {
    // No mine and no reactor: production and use are both 0, nothing falls.
    const idle = planet({ res: { m: 0, c: 0, d: 0 } });
    expect(prod(idle, U, r).d).toBe(0);
    expect(fusionThrottle(idle, U, r)).toBeNull();
    expect(production(idle, U, r)).toEqual(prod(idle, U, r));
  });
  it('stops growth at the storage limit but lets a use lower any stock', () => {
    const full = planet({ b: { deut: 5 }, res: { m: 2e6, c: 0, d: 0 } });
    const cap = caps(full, U).m;
    accrue(full, 3600000, U, r);
    expect(full.res.m).toBe(2e6);
    expect(full.res.c).toBeGreaterThan(0);
    expect(cap).toBeLessThan(2e6);
  });
  it('does not throttle while there is deuterium or enough production', () => {
    expect(fusionThrottle({ ...dry, res: { m: 0, c: 0, d: 1 } }, U, r)).toBe(
      null,
    );
    expect(production({ ...dry, res: { m: 0, c: 0, d: 1 } }, U, r)).toEqual(
      prod(dry, U, r),
    );
    const rich = { ...dry, b: { deut: 12, fusion: 8 } };
    expect(fusionThrottle(rich, U, r)).toBeNull();
  });
  it('produces at the throttled share and keeps the stock at 0', () => {
    const s = fusionThrottle(dry, U, r)!;
    const pr = production(dry, U, r);
    expect(pr).toEqual({ ...prod(at(dry, s), U, r), d: 0 });
    expect(pr.eProd).toBeLessThan(prod(dry, U, r).eProd);
  });
});

describe('accrue with a Fusionskraftwerk (#47 D1)', () => {
  const r = { energy: 3 };
  const src = (d: number): Planet =>
    planet({
      b: { deut: 5, fusion: 8, metal: 6 },
      temp: 20,
      res: { m: 1000, c: 1000, d },
    });
  it('splits the time where the stock runs empty', () => {
    const p = src(300);
    const full = prod(p, U, r);
    const empty = 300 / -full.d;
    accrue(p, 10 * H, U, r);
    expect(p.res.d).toBe(0);
    const thr = production({ ...src(0) }, U, r);
    expect(p.res.m).toBeCloseTo(
      1000 + full.m * empty + thr.m * (10 - empty),
      9,
    );
    expect(thr.m).toBeLessThan(full.m);
  });
  it('lets a stock that lasts fall without a split', () => {
    const p = src(300);
    const full = prod(p, U, r);
    accrue(p, H / 10, U, r);
    expect(p.res.d).toBeCloseTo(300 + full.d / 10, 9);
    expect(p.res.m).toBeCloseTo(1000 + full.m / 10, 9);
  });
  it('empties a stock exactly at the end of the time', () => {
    const p = src(0.1);
    const ms = (0.1 / -prod(p, U, r).d) * H;
    accrue(p, ms, U, r);
    expect(p.res.d).toBe(0);
  });
  it('uses deuterium above the storage limit too', () => {
    const p = src(250000);
    const full = prod(p, U, r);
    accrue(p, H, U, r);
    expect(p.res.d).toBeCloseTo(250000 + full.d, 6);
  });
  it('starts throttled on an empty stock', () => {
    const p = src(0);
    const thr = production(p, U, r);
    accrue(p, 2 * H, U, r);
    expect(p.res.d).toBe(0);
    expect(p.res.m).toBeCloseTo(1000 + 2 * thr.m, 9);
  });
});

/** A random planet with a Fusionskraftwerk, its research and a time. */
const reactorCase = fc.record({
  b: fc.record({
    deut: fc.integer({ min: 0, max: 14 }),
    fusion: fc.integer({ min: 1, max: 14 }),
    solar: fc.integer({ min: 0, max: 14 }),
    metal: fc.integer({ min: 0, max: 16 }),
    crystal: fc.integer({ min: 0, max: 14 }),
  }),
  pct: fc.record({
    fusion: fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
    deut: fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
    metal: fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
  }),
  temp: fc.integer({ min: -40, max: 140 }),
  d: fc.double({ min: 0, max: 20000, noNaN: true }),
  energy: fc.integer({ min: 0, max: 12 }),
  techEnd: fc.option(fc.integer({ min: 1, max: 40 * H })),
  buildEnd: fc.option(fc.integer({ min: 1, max: 40 * H })),
  cuts: fc.array(fc.integer({ min: 0, max: 48 * H }), { maxLength: 8 }),
  until: fc.integer({ min: 0, max: 48 * H }),
});

type ReactorCase = typeof reactorCase extends fc.Arbitrary<infer T> ? T : never;

function build(c: ReactorCase): { p: Planet; r: ResearchState } {
  const p = planet({
    b: c.b,
    pct: c.pct,
    temp: c.temp,
    res: { m: 1000, c: 1000, d: c.d },
  });
  if (c.buildEnd !== null)
    p.bq = {
      key: 'fusion',
      lvl: c.b.fusion + 1,
      start: 0,
      end: c.buildEnd,
      cost: [1, 1, 1],
    };
  const r: ResearchState = {
    research: { energy: c.energy },
    rq:
      c.techEnd === null
        ? null
        : {
            key: 'energy',
            lvl: c.energy + 1,
            start: 0,
            end: c.techEnd,
            cost: [0, 0, 0],
          },
  };
  return { p, r };
}

const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(b);

// 300 cases take well under a second, but much longer under the coverage
// instrumentation of Stryker; like the migration property tests, the test
// gets its own time limit instead of fewer cases.
const PROPERTY_TIMEOUT = 60_000;

describe('settling with a Fusionskraftwerk (#47)', () => {
  it(
    'gives the same stock in one step or in many',
    () => {
      fc.assert(
        fc.property(reactorCase, (c) => {
          const { p, r } = build(c);
          const once = settle(p, c.until, U, r);
          let step = p;
          for (const t of [...c.cuts.filter((x) => x < c.until)].sort(
            (x, y) => x - y,
          )) {
            step = settle(step, t, U, r);
            expect(step.res.d).toBeGreaterThanOrEqual(0);
          }
          step = settle(step, c.until, U, r);
          expect(once.res.d).toBeGreaterThanOrEqual(0);
          for (const k of ['m', 'c', 'd'] as const)
            expect(close(step.res[k], once.res[k])).toBe(true);
          expect(step.b).toEqual(once.b);
        }),
        { numRuns: 300, seed: 47 },
      );
    },
    PROPERTY_TIMEOUT,
  );
  it('splits where Energietechnik finishes', () => {
    const p = planet({
      b: { deut: 9, fusion: 6, metal: 12, crystal: 9 },
      temp: 30,
      res: { m: 0, c: 0, d: 50000 },
    });
    const r: ResearchState = {
      research: { energy: 3 },
      rq: { key: 'energy', lvl: 4, start: 0, end: H, cost: [0, 800, 400] },
    };
    const want = planet({ ...p, res: { ...p.res } });
    accrue(want, H, U, { energy: 3 });
    accrue(want, 2 * H, U, { energy: 4 });
    expect(settle(p, 3 * H, U, r).res).toEqual(want.res);
    const before = planet({ ...p, res: { ...p.res } });
    accrue(before, 3 * H, U, { energy: 3 });
    expect(settle(p, 3 * H, U, r).res).not.toEqual(before.res);
  });
  it('splits for no other research and for no planet without a reactor', () => {
    const p = planet({
      b: { deut: 9, fusion: 6, metal: 12, crystal: 9 },
      temp: 30,
      res: { m: 0, c: 0, d: 50000 },
    });
    const laser: ResearchState = {
      research: { energy: 3 },
      rq: { key: 'laser', lvl: 1, start: 0, end: H / 3, cost: [200, 100, 0] },
    };
    const want = planet({ ...p, res: { ...p.res } });
    accrue(want, 3 * H, U, { energy: 3 });
    expect(settle(p, 3 * H, U, laser).res).toEqual(want.res);
    const plain = planet({
      b: { deut: 9, metal: 12, crystal: 9, solar: 11 },
      temp: 30,
    });
    const tech: ResearchState = {
      research: { energy: 3 },
      rq: { key: 'energy', lvl: 4, start: 0, end: H / 3, cost: [0, 800, 400] },
    };
    expect(settle(plain, 3 * H, U, tech)).toEqual(settle(plain, 3 * H, U));
  });
  it('counts the reactor from the end of its building', () => {
    const p = planet({
      b: { deut: 9, metal: 12 },
      temp: 30,
      res: { m: 0, c: 0, d: 50000 },
      bq: { key: 'fusion', lvl: 1, start: 0, end: H, cost: [900, 360, 180] },
    });
    const r: ResearchState = { research: { energy: 3 }, rq: null };
    const want = planet({ ...p, bq: null, res: { ...p.res } });
    accrue(want, H, U, r.research);
    want.b = { ...want.b, fusion: 1 };
    accrue(want, 2 * H, U, r.research);
    expect(settle(p, 3 * H, U, r).res).toEqual(want.res);
  });
});
