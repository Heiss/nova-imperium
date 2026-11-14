// Contract of the component `mobile` (okf/architecture/patterns.md, section
// 12; #114): it runs for every entry that has it, so a new ship is checked
// without new test code.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from '../../features/index.gen.ts';
import {
  activeDrive,
  DRIVE_BONUS,
  type Mobile,
  speed,
  STATIONARY,
} from './mobile.ts';

const MOBILES = ENTRIES.flatMap(([key, e]) =>
  'mobile' in e ? [[key, e.mobile as Mobile] as const] : [],
);
const RESEARCH = new Set(
  ENTRIES.filter(([, e]) => e.kind === 'research').map(([key]) => key),
);
const DRIVES = Object.keys(DRIVE_BONUS);

/** Research levels 0 to 30 of the drives and of every research a switch needs. */
const levels = fc.dictionary(
  fc.constantFrom(...RESEARCH),
  fc.integer({ min: 0, max: 30 }),
);

describe('mobile: contract for every entry that has it', () => {
  it('is only on ships', () => {
    expect(MOBILES.length).toBeGreaterThan(0);
    for (const [key, e] of ENTRIES)
      if ('mobile' in e) expect(e.kind, key).toBe('ship');
  });

  it('names a research for every drive', () => {
    for (const d of DRIVES) expect(RESEARCH.has(d), d).toBe(true);
  });

  it.each(MOBILES)(
    '%s: flies with a speed above 0, carries whole cargo and burns fuel',
    (_, m) => {
      expect(m.speed).toBeGreaterThan(0);
      expect(Number.isInteger(m.cargo)).toBe(true);
      expect(m.cargo).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.fuel)).toBe(true);
      expect(m.fuel).toBeGreaterThan(0);
      expect(DRIVES).toContain(m.drive);
    },
  );

  it.each(MOBILES)(
    '%s: switches only to a known drive, from a research level above 0',
    (_, m) => {
      for (const d of m.drives ?? []) {
        expect(DRIVES).toContain(d.drive);
        expect(d.speed).toBeGreaterThan(0);
        expect(RESEARCH.has(d.from.research), d.from.research).toBe(true);
        expect(Number.isInteger(d.from.level)).toBe(true);
        expect(d.from.level).toBeGreaterThan(0);
      }
    },
  );

  it.each(MOBILES)(
    '%s: the speed is finite and at least the base speed of the drive it flies with',
    (_, m) => {
      fc.assert(
        fc.property(levels, (research) => {
          const s = speed(m, research);
          expect(Number.isFinite(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(activeDrive(m, research).speed);
        }),
      );
    },
  );
});

describe('mobile: the rule', () => {
  const ship: Mobile = {
    cargo: 10,
    speed: 4000,
    fuel: 3,
    drive: 'impulse',
    drives: [
      { drive: 'hdrive', speed: 5000, from: { research: 'hdrive', level: 8 } },
      { drive: 'comb', speed: 9000, from: { research: 'x', level: 2 } },
    ],
  };

  it('flies with the base drive until a switch is reached', () => {
    expect(activeDrive(ship, {})).toEqual({ drive: 'impulse', speed: 4000 });
    expect(activeDrive(ship, { hdrive: 7, x: 1 })).toEqual({
      drive: 'impulse',
      speed: 4000,
    });
    const plain: Mobile = { ...ship, drives: undefined };
    expect(activeDrive(plain, { hdrive: 30, x: 30 })).toEqual({
      drive: 'impulse',
      speed: 4000,
    });
  });

  it('takes the last switch whose research is reached', () => {
    expect(activeDrive(ship, { hdrive: 8 })).toEqual({
      drive: 'hdrive',
      speed: 5000,
    });
    expect(activeDrive(ship, { x: 2 })).toEqual({ drive: 'comb', speed: 9000 });
    expect(activeDrive(ship, { hdrive: 9, x: 3 })).toEqual({
      drive: 'comb',
      speed: 9000,
    });
  });

  it('adds the bonus of the active drive per research level', () => {
    expect(DRIVE_BONUS).toEqual({ comb: 0.1, impulse: 0.2, hdrive: 0.3 });
    expect(speed(ship, {})).toBe(4000);
    expect(speed(ship, { impulse: 2, hdrive: 7 })).toBe(4000 * 1.4);
    expect(speed(ship, { impulse: 2, hdrive: 8 })).toBe(5000 * (1 + 0.3 * 8));
    expect(speed(ship, { x: 2, comb: 5 })).toBe(9000 * 1.5);
  });

  it('keeps a ship without mobile at its planet', () => {
    expect(STATIONARY).toEqual({ cargo: 0, speed: 0, fuel: 0, drive: 'comb' });
    expect(speed(STATIONARY, { comb: 9 })).toBe(0);
  });
});
