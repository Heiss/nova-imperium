// The rules of the Auspex-Phalanx that the owner decided (#53, 2026-11-13):
// the range by level, the price of a scan, what can be scanned and what a
// scan shows of the flights of a planet.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SCAN_COST,
  SCAN_PRICE,
  inPhalanxRange,
  phalanxLevel,
  phalanxRange,
  type ScanTarget,
  type Scanner,
  scanError,
  scanFlights,
  scanReach,
  scanRefusal,
} from './phalanx.ts';
import type { Coords, Fleet, Resources } from './types.ts';

const AT = 'p1_5_7';

const fleet = (over: Partial<Fleet>): Fleet => ({
  id: 'f1',
  owner: 'u_Bert',
  from: 'p1_9_3',
  fromC: { g: 1, s: 9, p: 3 },
  to: AT,
  toC: { g: 1, s: 5, p: 7 },
  mission: 'attack',
  ships: { lc: 10, sc: 2 },
  cargo: { m: 500, c: 400, d: 300 },
  dep: 1000,
  arr: 5000,
  ret: 9000,
  state: 'out',
  recalled: false,
  fuel: 120,
  ...over,
});

describe('the range of the Auspex-Phalanx', () => {
  it('is level² − 1 systems', () => {
    expect([1, 2, 3, 4, 5, 10].map(phalanxRange)).toEqual([
      0, 3, 8, 15, 24, 99,
    ]);
  });

  it('is below 0 without a phalanx, so nothing is in range', () => {
    expect(phalanxRange(0)).toBe(-1);
  });

  it('grows with every level (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (level) => {
        expect(phalanxRange(level)).toBe(level * level - 1);
        expect(phalanxRange(level + 1)).toBeGreaterThan(phalanxRange(level));
      }),
    );
  });
});

describe('the price of a scan', () => {
  it('is 5,000 Promethium and nothing else', () => {
    expect(SCAN_COST).toEqual({ m: 0, c: 0, d: 5000 });
    expect(SCAN_PRICE).toEqual([0, 0, 5000]);
  });
});

describe('the level of the phalanx on a place', () => {
  it('is the building on a moon', () => {
    expect(phalanxLevel({ kind: 'moon', b: { phalanx: 3 } })).toBe(3);
    expect(phalanxLevel({ kind: 'moon', b: { moonbase: 2 } })).toBe(0);
  });

  it('is 0 on a planet, where it cannot stand', () => {
    expect(phalanxLevel({ kind: 'planet', b: { phalanx: 3 } })).toBe(0);
  });
});

const at = (g: number, s: number, p = 7): Coords => ({ g, s, p });

describe('the range over galaxies and systems (owner, 2026-11-15)', () => {
  it('counts |s − s₀| systems in the own galaxy', () => {
    // Level 2: 3 systems.
    expect(inPhalanxRange(at(1, 10), at(1, 13), 2)).toBe(true);
    expect(inPhalanxRange(at(1, 10), at(1, 7), 2)).toBe(true);
    expect(inPhalanxRange(at(1, 10), at(1, 14), 2)).toBe(false);
    expect(inPhalanxRange(at(1, 10), at(1, 6), 2)).toBe(false);
  });

  it('reaches only the own system at level 1, any position there', () => {
    expect(inPhalanxRange(at(1, 10, 1), at(1, 10, 15), 1)).toBe(true);
    expect(inPhalanxRange(at(1, 10), at(1, 11), 1)).toBe(false);
  });

  it('never reaches another galaxy, also at the same system', () => {
    expect(inPhalanxRange(at(1, 10), at(2, 10), 50)).toBe(false);
  });

  it('does not wrap around the end of the galaxy', () => {
    // 499 systems: system 1 and 499 are 498 apart, not 2.
    expect(inPhalanxRange(at(1, 1), at(1, 499), 2)).toBe(false);
    expect(inPhalanxRange(at(1, 1), at(1, 499), 23)).toBe(true);
  });

  it('reaches nothing without a phalanx', () => {
    expect(inPhalanxRange(at(1, 10), at(1, 10), 0)).toBe(false);
  });

  it('is symmetric and holds exactly within level² − 1 (property)', () => {
    const c = fc.record({
      g: fc.integer({ min: 1, max: 9 }),
      s: fc.integer({ min: 1, max: 499 }),
      p: fc.integer({ min: 1, max: 15 }),
    });
    fc.assert(
      fc.property(c, c, fc.integer({ min: 0, max: 30 }), (a, b, level) => {
        const inRange = inPhalanxRange(a, b, level);
        expect(inPhalanxRange(b, a, level)).toBe(inRange);
        expect(inRange).toBe(
          a.g === b.g && Math.abs(a.s - b.s) <= level * level - 1,
        );
        // One level more never loses a target.
        if (inRange) expect(inPhalanxRange(a, b, level + 1)).toBe(true);
      }),
    );
  });
});

const MOON: Scanner & { res: Resources } = {
  kind: 'moon',
  owner: 'u_Anna',
  b: { moonbase: 1, phalanx: 2 },
  g: 1,
  s: 5,
  p: 4,
  res: { m: 0, c: 0, d: 5000 },
};

const planetAt = (s: number, owner?: string, g = 1): ScanTarget => ({
  place: { kind: 'planet', g, s, p: 7 },
  ...(owner === undefined ? {} : { owner }),
});

describe('whether a scan can start', () => {
  it('starts from a moon with a phalanx at a foreign planet in range', () => {
    expect(scanReach(MOON, planetAt(8, 'u_Bert'))).toBeNull();
    expect(scanError(MOON, planetAt(8, 'u_Bert'))).toBeNull();
  });

  it('starts only from a moon', () => {
    const planet = { ...MOON, kind: 'planet' as const };
    expect(scanReach(planet, planetAt(5, 'u_Bert'))).toBe('notMoon');
  });

  it('needs a phalanx on the moon', () => {
    const bare = { ...MOON, b: { moonbase: 1 } };
    expect(scanReach(bare, planetAt(5, 'u_Bert'))).toBe('noPhalanx');
  });

  it('refuses a moon and a Trümmerfeld, also in range', () => {
    const moon = { place: { kind: 'moon' as const, g: 1, s: 5, p: 7 } };
    const field = { place: { kind: 'debris' as const, g: 1, s: 5, p: 7 } };
    expect(scanReach(MOON, { ...moon, owner: 'u_Bert' })).toBe('moon');
    expect(scanReach(MOON, field)).toBe('notPlanet');
  });

  it('refuses a planet out of range or in another galaxy', () => {
    expect(scanReach(MOON, planetAt(9, 'u_Bert'))).toBe('outOfRange');
    expect(scanReach(MOON, planetAt(5, 'u_Bert', 2))).toBe('outOfRange');
  });

  it('refuses a free position in range', () => {
    expect(scanReach(MOON, planetAt(6))).toBe('free');
  });

  it('refuses an own planet, the planet of the moon included', () => {
    expect(scanReach(MOON, planetAt(5, 'u_Anna'))).toBe('own');
  });

  it('needs the 5,000 Promethium on the moon, but only for a scan that can start', () => {
    const poor = { ...MOON, res: { m: 1e6, c: 1e6, d: 4999 } };
    expect(scanError(poor, planetAt(8, 'u_Bert'))).toBe('cost');
    expect(scanError(poor, planetAt(6))).toBe('free');
    expect(scanError(poor, planetAt(9, 'u_Bert'))).toBe('outOfRange');
  });

  it('starts exactly when the moon has a phalanx, the target is a foreign planet in range and the price is there (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('planet' as const, 'moon' as const),
        fc.integer({ min: 0, max: 4 }),
        fc.constantFrom('planet' as const, 'moon' as const, 'debris' as const),
        fc.integer({ min: 1, max: 30 }),
        fc.constantFrom(undefined, 'u_Anna', 'u_Bert'),
        fc.integer({ min: 0, max: 10000 }),
        (kind, level, targetKind, s, owner, d) => {
          const scanner = {
            ...MOON,
            kind,
            b: { moonbase: 1, phalanx: level },
            res: { m: 0, c: 0, d },
          };
          const target = {
            place: { kind: targetKind, g: 1, s, p: 7 },
            ...(owner === undefined ? {} : { owner }),
          };
          const ok =
            kind === 'moon' &&
            level > 0 &&
            targetKind === 'planet' &&
            Math.abs(s - MOON.s) <= level * level - 1 &&
            owner === 'u_Bert' &&
            d >= 5000;
          expect(scanError(scanner, target) === null).toBe(ok);
          if (scanReach(scanner, target) !== null)
            expect(scanError(scanner, target)).toBe(scanReach(scanner, target));
        },
      ),
    );
  });
});

describe('what can be scanned', () => {
  it('is a foreign planet', () => {
    expect(scanRefusal('planet', 'u_Bert', 'u_Anna')).toBeNull();
  });

  it('is never a moon, also a foreign one', () => {
    expect(scanRefusal('moon', 'u_Bert', 'u_Anna')).toBe('moon');
    expect(scanRefusal('moon', 'u_Anna', 'u_Anna')).toBe('moon');
  });

  it('is never a Trümmerfeld', () => {
    expect(scanRefusal('debris', null, 'u_Anna')).toBe('notPlanet');
  });

  it('is never an own planet', () => {
    expect(scanRefusal('planet', 'u_Anna', 'u_Anna')).toBe('own');
  });
});

describe('what a scan shows', () => {
  it('shows a flight to the planet with ships, origin, target and arrival', () => {
    expect(scanFlights([fleet({})], AT)).toEqual([
      { ships: { lc: 10, sc: 2 }, from: 'p1_9_3', to: AT, arr: 5000 },
    ]);
  });

  it('shows a flight from the planet, arriving at its target', () => {
    const out = fleet({ from: AT, to: 'p1_9_3', owner: 'u_Cleo' });
    expect(scanFlights([out], AT)).toEqual([
      { ships: { lc: 10, sc: 2 }, from: AT, to: 'p1_9_3', arr: 5000 },
    ]);
  });

  it('shows a fleet flying back by the leg it flies, with its return', () => {
    const home = fleet({ from: AT, to: 'p1_9_3', state: 'back' });
    const away = fleet({ id: 'f2', state: 'back' });
    expect(scanFlights([home, away], AT)).toEqual([
      { ships: { lc: 10, sc: 2 }, from: 'p1_9_3', to: AT, arr: 9000 },
      { ships: { lc: 10, sc: 2 }, from: AT, to: 'p1_9_3', arr: 9000 },
    ]);
  });

  it('shows a recalled fleet from where it turned back, its target, arriving home', () => {
    // Sent from the planet to p1_9_3 and recalled on the way: a fleet has no
    // position between two places, so its leg starts at the target it
    // turned away from.
    const recalled = fleet({
      from: AT,
      to: 'p1_9_3',
      state: 'back',
      recalled: true,
      ret: 6000,
    });
    expect(scanFlights([recalled], AT)).toEqual([
      { ships: { lc: 10, sc: 2 }, from: 'p1_9_3', to: AT, arr: 6000 },
    ]);
  });

  it('shows the gift of the Endzeit like any fleet, from and to the home planet', () => {
    const gift = fleet({ from: AT, to: AT, gift: true, mission: 'deploy' });
    expect(scanFlights([gift], AT)).toEqual([
      { ships: { lc: 10, sc: 2 }, from: AT, to: AT, arr: 5000 },
    ]);
  });

  it('leaves out the flights of other places, the moon of the planet included', () => {
    const others = [
      fleet({ to: 'm1_5_7' }),
      fleet({ from: 'm1_5_7', to: 'p1_9_3' }),
      fleet({ to: 'd1_5_7' }),
      fleet({ to: 'p1_5_8' }),
      fleet({ from: 'p2_5_7', to: 'p1_9_9' }),
    ];
    expect(scanFlights(others, AT)).toEqual([]);
  });

  it('shows nothing of the cargo, the owner, the mission or the fuel', () => {
    const [seen] = scanFlights([fleet({ gift: true, recalled: true })], AT);
    expect(Object.keys(seen!).sort()).toEqual(['arr', 'from', 'ships', 'to']);
  });

  it('copies the ships, so the scan cannot change the fleet', () => {
    const f = fleet({});
    scanFlights([f], AT)[0]!.ships.lc = 99;
    expect(f.ships.lc).toBe(10);
  });

  it('lists the flights by their arrival, the first first', () => {
    const list = scanFlights(
      [
        fleet({ id: 'a', arr: 7000 }),
        fleet({ id: 'b', arr: 3000 }),
        fleet({ id: 'c', from: AT, to: 'p1_9_3', state: 'back', ret: 5000 }),
      ],
      AT,
    );
    expect(list.map((x) => x.arr)).toEqual([3000, 5000, 7000]);
  });

  it('shows exactly the flights that start or end at the planet (property)', () => {
    const place = fc.constantFrom(AT, 'p1_9_3', 'm1_5_7', 'd1_5_7', 'p3_1_1');
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            from: place,
            to: place,
            state: fc.constantFrom('out' as const, 'back' as const),
            arr: fc.integer({ min: 0, max: 1e6 }),
            ret: fc.integer({ min: 0, max: 1e6 }),
          }),
          { maxLength: 12 },
        ),
        (legs) => {
          const fleets = legs.map((l, i) => fleet({ ...l, id: `f${i}` }));
          const seen = scanFlights(fleets, AT);
          const at = fleets.filter((f) => f.from === AT || f.to === AT);
          expect(seen).toHaveLength(at.length);
          for (const x of seen) expect([x.from, x.to]).toContain(AT);
          const arrivals = seen.map((x) => x.arr);
          expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
        },
      ),
    );
  });
});
