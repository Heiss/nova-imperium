// The rules of the Auspex-Phalanx that the owner decided (#53, 2026-11-13):
// the range by level, the price of a scan, what can be scanned and what a
// scan shows of the flights of a planet.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  SCAN_COST,
  phalanxRange,
  scanFlights,
  scanRefusal,
} from './phalanx.ts';
import type { Fleet } from './types.ts';

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
