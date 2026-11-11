import { describe, expect, it } from 'vitest';
import { U } from '../test/fixtures.ts';
import {
  capacity,
  countUnits,
  distance,
  fleetSlots,
  fleetSpeed,
  flightMs,
  fuelFor,
  pid,
  shipSpeed,
} from './flight.ts';

describe('flights', () => {
  it('allow one fleet plus one per level of Computertechnik', () => {
    expect(fleetSlots({ research: {} })).toBe(1);
    expect(fleetSlots({ research: { computer: 4 } })).toBe(5);
  });
  it('build the planet id from the coordinates', () => {
    expect(pid({ g: 2, s: 33, p: 7 })).toBe('p2_33_7');
  });
  it('measure distances between galaxies, systems and positions', () => {
    expect(distance({ g: 1, s: 1, p: 1 }, { g: 3, s: 9, p: 9 })).toBe(40000);
    expect(distance({ g: 1, s: 10, p: 1 }, { g: 1, s: 4, p: 9 })).toBe(
      2700 + 95 * 6,
    );
    expect(distance({ g: 1, s: 1, p: 9 }, { g: 1, s: 1, p: 2 })).toBe(
      1000 + 35,
    );
    expect(distance({ g: 1, s: 1, p: 1 }, { g: 1, s: 1, p: 1 })).toBe(5);
  });
  it('raise the speed with the drive research', () => {
    expect(shipSpeed('lf', { research: {} })).toBe(12500);
    expect(shipSpeed('lf', { research: { comb: 2 } })).toBe(15000);
    expect(shipSpeed('cr', { research: { impulse: 1 } })).toBe(18000);
    expect(shipSpeed('bs', { research: { hdrive: 2 } })).toBe(16000);
    expect(shipSpeed('rl', { research: {} })).toBe(0);
  });
  it('use the slowest ship of the fleet', () => {
    expect(fleetSpeed({ lf: 1, sc: 2, bs: 0 }, { research: {} })).toBe(5000);
    expect(fleetSpeed({}, { research: {} })).toBe(Infinity);
  });
  it('compute duration, fuel and cargo', () => {
    expect(flightMs(5, 5000, 10, U)).toBe(
      Math.round(((3500 * Math.sqrt(0.01) + 10) / 5) * 1000),
    );
    expect(flightMs(1035, 12500, 5, U)).toBe(
      Math.round(((7000 * Math.sqrt(10350 / 12500) + 10) / 5) * 1000),
    );
    expect(fuelFor({ sc: 2, lf: 0 }, 35000, 10)).toBe(81);
    expect(fuelFor({ sc: 1, lc: 1 }, 3500, 5)).toBe(
      Math.round((((10 + 50) * 3500) / 35000) * 2.25) + 1,
    );
    expect(fuelFor({ nope: 3 }, 3500, 5)).toBe(1);
    expect(capacity({ sc: 2, lc: 1, nope: 9 })).toBe(35000);
  });
  it('count units', () => {
    expect(countUnits({ a: 2, b: 3 })).toBe(5);
    expect(countUnits(null)).toBe(0);
    expect(countUnits(undefined)).toBe(0);
  });
});
