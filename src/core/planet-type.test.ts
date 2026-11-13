import { describe, expect, it } from 'vitest';
import {
  PLANET_TYPE_NAMES,
  PLANET_VARIANTS,
  planetType,
  planetVariant,
} from './planet-type.ts';

// The table of issue #52 (decision D2.1): slot and system parity.
const TABLE: [number, string, string][] = [
  [1, 'trocken', 'wueste'],
  [2, 'trocken', 'wueste'],
  [3, 'trocken', 'wueste'],
  [4, 'normal', 'trocken'],
  [5, 'normal', 'trocken'],
  [6, 'dschungel', 'normal'],
  [7, 'dschungel', 'normal'],
  [8, 'wasser', 'dschungel'],
  [9, 'wasser', 'dschungel'],
  [10, 'eis', 'wasser'],
  [11, 'eis', 'wasser'],
  [12, 'gas', 'eis'],
  [13, 'gas', 'eis'],
  [14, 'normal', 'gas'],
  [15, 'normal', 'gas'],
];

describe('planet type', () => {
  it('follows the table of slot and system parity', () => {
    for (const [p, odd, even] of TABLE) {
      expect(planetType({ s: 1, p }), `odd ${p}`).toBe(odd);
      expect(planetType({ s: 50, p }), `even ${p}`).toBe(even);
    }
  });
  it('makes every slot beyond 15 a gas giant, whatever the system', () => {
    for (let p = 16; p <= 20; p++) {
      expect(planetType({ s: 3, p })).toBe('gas');
      expect(planetType({ s: 4, p })).toBe('gas');
    }
  });
  it('has a German name for every type', () => {
    expect(PLANET_TYPE_NAMES).toEqual({
      wueste: 'Wüstenplanet',
      trocken: 'Trockener Planet',
      normal: 'Normaler Planet',
      dschungel: 'Dschungelplanet',
      wasser: 'Wasserplanet',
      eis: 'Eisplanet',
      gas: 'Gasriese',
    });
  });
  it('picks one of three fixed variants from the coordinates', () => {
    expect(PLANET_VARIANTS).toBe(3);
    expect(planetVariant({ g: 1, s: 1, p: 1 })).toBe(0);
    expect(planetVariant({ g: 1, s: 1, p: 2 })).toBe(1);
    expect(planetVariant({ g: 1, s: 1, p: 3 })).toBe(2);
    expect(planetVariant({ g: 1, s: 2, p: 1 })).toBe(1);
    expect(planetVariant({ g: 2, s: 1, p: 1 })).toBe(1);
    expect(planetVariant({ g: 9, s: 499, p: 20 })).toBe((9 + 499 + 20) % 3);
  });
  it('gives neighbours in a system different variants', () => {
    const seen = new Set(
      [4, 5, 6].map((p) => planetVariant({ g: 1, s: 7, p })),
    );
    expect(seen.size).toBe(3);
  });
});
