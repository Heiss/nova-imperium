import { describe, expect, it } from 'vitest';
import { U } from '../test/fixtures.ts';
import {
  activeDrive,
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
  it('fly Schlachtkreuzer and Zerstörer with the Hyperraumantrieb, +30 % per level (#58, #59)', () => {
    expect(shipSpeed('bc', { research: {} })).toBe(10000);
    expect(
      shipSpeed('bc', { research: { hdrive: 5, impulse: 9, comb: 9 } }),
    ).toBe(25000);
    expect(shipSpeed('dr', { research: {} })).toBe(5000);
    expect(shipSpeed('dr', { research: { hdrive: 6 } })).toBe(14000);
    expect(fleetSpeed({ bc: 2, dr: 1 }, { research: { hdrive: 6 } })).toBe(
      14000,
    );
  });
  it('fuel and cargo of Schlachtkreuzer and Zerstörer (#58, #59)', () => {
    expect(fuelFor({ bc: 1 }, 35000, 10)).toBe(1001);
    expect(fuelFor({ dr: 2 }, 3500, 5)).toBe(451);
    expect(capacity({ bc: 2, dr: 1 })).toBe(3500);
  });
  it('fly the Bomber with the Impulstriebwerk below Hyperraumantrieb 8 (#57)', () => {
    expect(shipSpeed('bb', { research: {} })).toBe(4000);
    expect(shipSpeed('bb', { research: { impulse: 6 } })).toBe(
      4000 * (1 + 0.2 * 6),
    );
    expect(
      shipSpeed('bb', { research: { impulse: 6, hdrive: 7, comb: 9 } }),
    ).toBe(8800);
    expect(activeDrive('bb', { research: { impulse: 6, hdrive: 7 } })).toEqual({
      drive: 'impulse',
      speed: 4000,
    });
  });
  it('switch the Bomber to the Hyperraumantrieb from level 8 (#57)', () => {
    expect(shipSpeed('bb', { research: { impulse: 6, hdrive: 8 } })).toBe(
      5000 * (1 + 0.3 * 8),
    );
    expect(shipSpeed('bb', { research: { impulse: 20, hdrive: 9 } })).toBe(
      18500,
    );
    expect(activeDrive('bb', { research: { hdrive: 8 } })).toEqual({
      drive: 'hdrive',
      speed: 5000,
    });
  });
  it('keep the single drive of every other ship (#57)', () => {
    expect(activeDrive('lf', { research: { hdrive: 8 } })).toEqual({
      drive: 'comb',
      speed: 12500,
    });
    expect(activeDrive('bs', { research: {} })).toEqual({
      drive: 'hdrive',
      speed: 10000,
    });
    expect(activeDrive('rl', { research: {} })).toBeNull();
    expect(activeDrive('toString', { research: {} })).toBeNull();
  });
  it('let the Bomber set the speed of a mixed fleet with its active drive (#57)', () => {
    const before = { research: { impulse: 6, hdrive: 7 } };
    expect(fleetSpeed({ bb: 3, bs: 2, cr: 1 }, before)).toBe(8800);
    const after = { research: { impulse: 6, hdrive: 8 } };
    expect(fleetSpeed({ bb: 3, bs: 2, cr: 1 }, after)).toBe(17000);
    expect(fleetSpeed({ bb: 1, dr: 1 }, after)).toBe(17000);
    expect(fleetSpeed({ bb: 0, dr: 1 }, after)).toBe(17000);
    expect(fleetSpeed({ bb: 1, colony: 1 }, after)).toBe(2500 * 2.2);
  });
  it('fuel and cargo of the Bomber, the same with both drives (#57)', () => {
    expect(fuelFor({ bb: 1 }, 35000, 10)).toBe(4001);
    expect(fuelFor({ bb: 2, bc: 1 }, 3500, 5)).toBe(507);
    expect(capacity({ bb: 2, bc: 1 })).toBe(1750);
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
