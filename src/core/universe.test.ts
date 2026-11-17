import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNIVERSE,
  inUniverse,
  UNIVERSE_SPECS,
  universeErrors,
  universeOf,
} from './universe.ts';

const used = { g: 1, s: 10, p: 12 };

const spec = (key: string) => UNIVERSE_SPECS.find((s) => s.key === key)!;

/** The codes of the refused settings, by key (#214). */
const codes = (input: Record<string, unknown>, at = used) =>
  universeErrors(input, at).map((e) => [e.spec.key, e.code]);

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
      // Added by #161 (owner, 2026-11-14): the gift flies 4 h by default.
      endzeitMinutes: 240,
      // Added by #228 (owner, 2026-11-16, D1): classic 2 / 4 / 8.
      roundRecognitionTotal: 2,
      roundRecognitionTypes: 4,
      roundRecognitionCounts: 8,
    });
    for (const s of UNIVERSE_SPECS) {
      expect(s.def).toBeGreaterThanOrEqual(s.min);
      expect(s.def).toBeLessThanOrEqual(s.max);
    }
  });
  it('name each setting as the form and the messages show it', () => {
    expect(UNIVERSE_SPECS.map((s) => [s.key, s.label])).toEqual([
      ['speed', 'Tempo (Faktor)'],
      ['galaxies', 'Galaxien'],
      ['systems', 'Systeme je Galaxie'],
      ['positions', 'Positionen je System'],
      ['baseStore', 'Grundlager je Rohstoff'],
      ['maxReports', 'Berichte je Spieler'],
      ['startMetal', 'Start-Adamant'],
      ['startCrystal', 'Start-Psikristall'],
      ['startDeuterium', 'Start-Promethium'],
      ['extraFields', 'Zusatzfelder pro Planet'],
      ['endzeitMinutes', 'Flugzeit der Endzeit-Gabe (Minuten)'],
      [
        'roundRecognitionTotal',
        'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre',
      ],
      ['roundRecognitionTypes', 'Fremde Flotten: Schiffstypen ab Auspex-Lehre'],
      [
        'roundRecognitionCounts',
        'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre',
      ],
    ]);
  });
  it('accept valid values given as strings', () => {
    const input = Object.fromEntries(
      Object.entries(DEFAULT_UNIVERSE).map(([k, v]) => [k, String(v)]),
    );
    expect(universeErrors(input, used)).toEqual([]);
    expect(universeOf(input)).toEqual(DEFAULT_UNIVERSE);
  });
  it('accept the bounds and reject values outside', () => {
    expect(codes({ ...DEFAULT_UNIVERSE, speed: 1 })).toEqual([]);
    expect(codes({ ...DEFAULT_UNIVERSE, speed: 100 })).toEqual([]);
    // The spec itself, so the server can word it (#214).
    expect(universeErrors({ ...DEFAULT_UNIVERSE, speed: 0 }, used)).toEqual([
      { spec: spec('speed'), code: 'range' },
    ]);
    for (const speed of [101, 2.5, 'x'])
      expect(codes({ ...DEFAULT_UNIVERSE, speed })).toEqual([
        ['speed', 'range'],
      ]);
  });
  it('take 0 to 100 extra fields per planet (#51, D4)', () => {
    expect(spec('extraFields')).toEqual({
      key: 'extraFields',
      label: 'Zusatzfelder pro Planet',
      min: 0,
      max: 100,
      def: 0,
    });
    for (const extraFields of [0, 100])
      expect(codes({ ...DEFAULT_UNIVERSE, extraFields })).toEqual([]);
    for (const extraFields of [101, -1])
      expect(codes({ ...DEFAULT_UNIVERSE, extraFields })).toEqual([
        ['extraFields', 'range'],
      ]);
  });
  it('take 1 to 4,320 minutes as the Endzeit flight time (#161)', () => {
    expect(spec('endzeitMinutes')).toEqual({
      key: 'endzeitMinutes',
      label: 'Flugzeit der Endzeit-Gabe (Minuten)',
      min: 1,
      max: 4320,
      def: 240,
    });
    for (const endzeitMinutes of [1, 4320])
      expect(codes({ ...DEFAULT_UNIVERSE, endzeitMinutes })).toEqual([]);
    for (const endzeitMinutes of [0, 4321, 1.5])
      expect(codes({ ...DEFAULT_UNIVERSE, endzeitMinutes })).toEqual([
        ['endzeitMinutes', 'range'],
      ]);
  });
  it('take levels 0 to 100 as the thresholds of foreign fleets (#228, X1)', () => {
    for (const [key, def] of [
      ['roundRecognitionTotal', 2],
      ['roundRecognitionTypes', 4],
      ['roundRecognitionCounts', 8],
    ] as const) {
      expect(spec(key)).toEqual({
        key,
        label: spec(key).label,
        min: 0,
        max: 100,
        def,
      });
      for (const value of [0, 100])
        expect(codes({ ...DEFAULT_UNIVERSE, [key]: value })).toEqual([]);
      for (const value of [-1, 101, 1.5])
        expect(codes({ ...DEFAULT_UNIVERSE, [key]: value })).toEqual([
          [key, 'range'],
        ]);
    }
  });
  it('report all errors at once, in the order of the specs', () => {
    expect(codes({})).toEqual(UNIVERSE_SPECS.map((s) => [s.key, 'range']));
  });
  it('never shrink below a used coordinate', () => {
    const big = { g: 2, s: 40, p: 14 };
    expect(
      codes(
        { ...DEFAULT_UNIVERSE, galaxies: 2, systems: 40, positions: 14 },
        big,
      ),
    ).toEqual([]);
    expect(
      codes(
        { ...DEFAULT_UNIVERSE, galaxies: 1, systems: 39, positions: 13 },
        big,
      ),
    ).toEqual([
      ['galaxies', 'used'],
      ['systems', 'used'],
      ['positions', 'used'],
    ]);
    // Out of range comes first: one code per setting.
    expect(
      codes({ ...DEFAULT_UNIVERSE, galaxies: 0 }, { g: 2, s: 1, p: 1 }),
    ).toEqual([['galaxies', 'range']]);
  });
  it('refuse exactly the values outside the range (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...UNIVERSE_SPECS),
        fc.oneof(fc.integer({ min: -20, max: 10_000_100 }), fc.double()),
        (s, value) => {
          const ok =
            Number.isInteger(value) && value >= s.min && value <= s.max;
          const none = { g: 0, s: 0, p: 0 };
          expect(codes({ ...DEFAULT_UNIVERSE, [s.key]: value }, none)).toEqual(
            ok ? [] : [[s.key, 'range']],
          );
        },
      ),
    );
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
