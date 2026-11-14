import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNIVERSE,
  inUniverse,
  UNIVERSE_SPECS,
  validateUniverse,
} from './universe.ts';

const used = { g: 1, s: 10, p: 12 };

describe('universe settings', () => {
  it('have the defaults of version 1', () => {
    expect(DEFAULT_UNIVERSE).toEqual({
      speed: 5,
      galaxies: 2,
      systems: 50,
      positions: 15,
      baseStore: 100000,
      maxReports: 60,
      startMetal: 500,
      startCrystal: 500,
      startDeuterium: 0,
      // Added by #51, D4: no extra fields by default.
      extraFields: 0,
    });
    for (const s of UNIVERSE_SPECS) {
      expect(s.def).toBeGreaterThanOrEqual(s.min);
      expect(s.def).toBeLessThanOrEqual(s.max);
    }
  });
  it('accept valid values given as strings', () => {
    const input = Object.fromEntries(
      Object.entries(DEFAULT_UNIVERSE).map(([k, v]) => [k, String(v)]),
    );
    expect(validateUniverse(input, used)).toEqual({
      ok: true,
      value: DEFAULT_UNIVERSE,
    });
  });
  it('accept the bounds and reject values outside', () => {
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 1 }, used).ok).toBe(
      true,
    );
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 100 }, used).ok).toBe(
      true,
    );
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 0 }, used)).toEqual({
      ok: false,
      errors: ['Tempo (Faktor): ganze Zahl von 1 bis 100.'],
    });
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 101 }, used).ok).toBe(
      false,
    );
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 2.5 }, used).ok).toBe(
      false,
    );
    expect(validateUniverse({ ...DEFAULT_UNIVERSE, speed: 'x' }, used).ok).toBe(
      false,
    );
  });
  it('take 0 to 100 extra fields per planet (#51, D4)', () => {
    const spec = UNIVERSE_SPECS.find((s) => s.key === 'extraFields');
    expect(spec).toEqual({
      key: 'extraFields',
      label: 'Zusatzfelder pro Planet',
      min: 0,
      max: 100,
      def: 0,
    });
    for (const extraFields of [0, 100])
      expect(
        validateUniverse({ ...DEFAULT_UNIVERSE, extraFields }, used).ok,
      ).toBe(true);
    expect(
      validateUniverse({ ...DEFAULT_UNIVERSE, extraFields: 101 }, used),
    ).toEqual({
      ok: false,
      errors: ['Zusatzfelder pro Planet: ganze Zahl von 0 bis 100.'],
    });
    expect(
      validateUniverse({ ...DEFAULT_UNIVERSE, extraFields: -1 }, used).ok,
    ).toBe(false);
  });
  it('report all errors at once', () => {
    const r = validateUniverse({}, used);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(UNIVERSE_SPECS.length);
  });
  it('never shrink below a used coordinate', () => {
    const big = { g: 2, s: 40, p: 14 };
    expect(
      validateUniverse(
        { ...DEFAULT_UNIVERSE, galaxies: 2, systems: 40, positions: 14 },
        big,
      ).ok,
    ).toBe(true);
    const r = validateUniverse(
      { ...DEFAULT_UNIVERSE, galaxies: 1, systems: 39, positions: 13 },
      big,
    );
    expect(r).toEqual({
      ok: false,
      errors: [
        'Galaxien: mindestens 2, dort liegen schon Planeten.',
        'Systeme je Galaxie: mindestens 40, dort liegen schon Planeten.',
        'Positionen je System: mindestens 14, dort liegen schon Planeten.',
      ],
    });
  });
});

describe('positions inside the universe', () => {
  const u = { ...DEFAULT_UNIVERSE, galaxies: 2, systems: 3, positions: 4 };

  it('take every position up to the configured counts', () => {
    expect(inUniverse({ g: 1, s: 1, p: 1 }, u)).toBe(true);
    expect(inUniverse({ g: 2, s: 3, p: 4 }, u)).toBe(true);
  });

  it('refuse a galaxy, system or position beyond them', () => {
    expect(inUniverse({ g: 3, s: 3, p: 4 }, u)).toBe(false);
    expect(inUniverse({ g: 2, s: 4, p: 4 }, u)).toBe(false);
    expect(inUniverse({ g: 2, s: 3, p: 5 }, u)).toBe(false);
  });
});
