// The port to TypeScript must compute exactly what the original game.js
// computed (src/test/legacy/game.cjs, frozen). Random cases with a fixed seed,
// compared to the last digit, the battle with the same random stream.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { seeded, U } from '../test/fixtures.ts';
import { renamed } from '../test/naming.ts';
import * as N from './index.ts';
import type { Levels, Planet } from './types.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const O: any = require('../test/legacy/game.cjs');

const CASES = 400;
const rnd = seeded(20261106);
const ri = (a: number, b: number): number =>
  a + Math.floor(rnd() * (b - a + 1));
const pick = (keys: string[], chance: number, lo: number, hi: number): Levels =>
  Object.fromEntries(
    keys.filter(() => rnd() < chance).map((k) => [k, ri(lo, hi)]),
  );

function randomPlanet(): Planet {
  const t0 = ri(0, 1e6);
  // Version 1 knows no Nanitenfabrik (#48) and no Fusionskraftwerk (#47):
  // its planets have level 0.
  const b = pick(Object.keys(O.BUILD), 0.7, 0, 15);
  const p: Planet = {
    id: 'x',
    kind: 'planet',
    owner: 'u',
    name: 'n',
    g: 1,
    s: 1,
    p: 5,
    temp: ri(-40, 140),
    // Version 1 knows no fields (#51); settling does not read them.
    diameter: 12800,
    unlimited: true,
    res: { m: ri(0, 2e5), c: ri(0, 2e5), d: ri(0, 1e5) },
    b,
    ships: {},
    def: {},
    bq: null,
    sq: [],
    sqT: null,
    pct: Object.fromEntries(
      N.PRODUCERS.filter(() => rnd() < 0.3).map((k) => [k, ri(0, 10) * 10]),
    ),
    t: t0,
    created: 0,
  };
  if (rnd() < 0.5)
    p.bq = {
      key: 'metal',
      lvl: (b.metal ?? 0) + 1,
      start: t0,
      end: t0 + ri(1, 5e6),
      cost: [1, 1, 1],
    };
  if (rnd() < 0.5) {
    p.sq = [
      { key: 'lf', n: ri(1, 30), unit: ri(1000, 90000) },
      { key: 'rl', n: ri(1, 30), unit: ri(1000, 90000) },
    ];
    p.sqT = t0 + ri(0, 10000);
  }
  return p;
}

const cases = Array.from({ length: CASES }, () => {
  const planet = randomPlanet();
  return {
    planet,
    until: planet.t + ri(0, 2e7),
    research: { research: pick(Object.keys(O.RES), 1, 0, 12), rq: null },
    a: { g: ri(1, 2), s: ri(1, 50), p: ri(1, 15) },
    b: { g: ri(1, 2), s: ri(1, 50), p: ri(1, 15) },
    ships: pick(Object.keys(O.SHIPS), 0.5, 0, 50),
    units: pick(Object.keys(O.UNIT), 0.4, 0, 40),
    tA: { weapons: ri(0, 8), shield: ri(0, 8), armor: ri(0, 8) },
    tD: { weapons: ri(0, 8), shield: ri(0, 8), armor: ri(0, 8) },
    pct: ri(1, 10),
    seed: ri(1, 1e9),
    level: ri(1, 25),
  };
});

describe('equivalence with the original rules', () => {
  it('settle and production', () => {
    for (const c of cases) {
      expect(N.settle(c.planet, c.until, U)).toEqual(
        O.settle(c.planet, c.until),
      );
      // The research of the owner changes nothing without a Fusionskraftwerk.
      expect(N.settle(c.planet, c.until, U, c.research)).toEqual(
        O.settle(c.planet, c.until),
      );
      expect(N.prod(c.planet, U)).toEqual(O.prod(c.planet));
      expect(N.prod(c.planet, U, c.research.research)).toEqual(
        O.prod(c.planet),
      );
      expect(N.caps(c.planet, U)).toEqual(O.caps(c.planet));
    }
  });

  it('costs and times', () => {
    for (const c of cases) {
      for (const k of Object.keys(O.BUILD)) {
        const cost = N.lvlCost(N.BUILD[k]!, c.level);
        expect(cost).toEqual(O.lvlCost(O.BUILD[k], c.level));
        expect(N.buildTime(cost, c.planet, U)).toBe(
          Math.ceil(O.buildTime(cost, c.planet)),
        );
        expect(N.sumLevels(N.BUILD[k]!, c.level)).toBe(
          O.sumLevels(O.BUILD[k], c.level),
        );
      }
      for (const k of Object.keys(O.RES)) {
        const cost = N.lvlCost(N.RES[k]!, c.level);
        expect(cost).toEqual(O.lvlCost(O.RES[k], c.level));
        expect(N.researchTime(cost, c.planet, U)).toBe(
          Math.ceil(O.researchTime(cost, c.planet)),
        );
      }
      for (const k of Object.keys(O.UNIT))
        expect(N.unitTime(N.UNIT[k]!, c.planet, U)).toBe(
          Math.ceil(O.unitTime(O.UNIT[k], c.planet)),
        );
      const cost = [ri(0, 9000), ri(0, 9000), ri(0, 900)] as const;
      expect(N.maxAfford(c.planet, cost)).toBe(O.maxAfford(c.planet, cost));
      // The same requirements and levels; the names are those of the
      // grimdark naming (#94), mapped through its table.
      expect(N.reqMissing(N.SHIPS.cr!, c.planet, c.research)).toEqual(
        O.reqMissing(O.SHIPS.cr, c.planet, c.research).map(renamed),
      );
    }
  });

  it('flights', () => {
    for (const c of cases) {
      const dist = N.distance(c.a, c.b);
      expect(dist).toBe(O.distance(c.a, c.b));
      expect(N.fleetSpeed(c.ships, c.research)).toBe(
        O.fleetSpeed(c.ships, c.research),
      );
      expect(N.fuelFor(c.ships, dist, c.pct)).toBe(
        O.fuelFor(c.ships, dist, c.pct),
      );
      expect(N.capacity(c.ships)).toBe(O.capacity(c.ships));
      if (N.countUnits(c.ships)) {
        const speed = N.fleetSpeed(c.ships, c.research);
        expect(N.flightMs(dist, speed, c.pct, U)).toBe(
          O.flightMs(dist, speed, c.pct),
        );
      }
    }
  });

  it('battles with the same random stream', () => {
    const original = Math.random;
    try {
      for (const c of cases) {
        const stream = (): (() => number) => {
          let x = c.seed;
          return () => (x = (x * 48271) % 2147483647) / 2147483647;
        };
        Math.random = stream();
        const old = O.battle(
          { units: c.ships, tech: c.tA },
          { units: c.units, tech: c.tD },
        );
        const now = N.battle(
          { units: c.ships, tech: c.tA },
          { units: c.units, tech: c.tD },
          stream(),
        );
        expect(now).toEqual(old);
      }
    } finally {
      Math.random = original;
    }
  });
});
