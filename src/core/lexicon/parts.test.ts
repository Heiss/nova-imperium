import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { BUILD, RES } from '../catalog.ts';
import { fill } from './links.ts';
import {
  costFormula,
  drivePart,
  number,
  percent,
  storageFormula,
  techPart,
} from './parts.ts';
import type { Formula } from './types.ts';

const agrees = (f: Formula): void => {
  expect(fill(f.text, f.values)).not.toMatch(/\{\w+\}/);
  for (const x of f.samples) expect(f.fn(...x)).toBeCloseTo(f.rule(...x), 9);
};

describe('the shared lexicon parts (#285)', () => {
  it('formats German numbers and percentages', () => {
    expect(number(50000)).toBe('50.000');
    expect(number(1.6)).toBe('1,6');
    expect(percent(0.1)).toBe('10 %');
    expect(percent(0.025)).toBe('2,5 %');
  });

  it('states the cost of every entry with levels (B8)', () => {
    for (const def of [...Object.values(BUILD), ...Object.values(RES)])
      agrees(costFormula(def.f ?? 2));
    expect(fill(costFormula(1.5).text, costFormula(1.5).values)).toBe(
      'Kosten = Kosten der Stufe 1 · 1,5^(Stufe − 1)',
    );
  });

  it('states the capacity of a store (B8)', () => {
    agrees(storageFormula(U));
    agrees(storageFormula({ ...U, baseStore: 1 }));
  });

  it('builds the parts of the tech and drive research', () => {
    const tech = techPart('weapons', 'attack', 'Angriff');
    expect(tech.effect!.at(3)).toBeCloseTo(0.3, 9);
    expect(tech.effect!.label).toBe('Angriff');
    agrees(tech.formulas![0]!);
    const drive = drivePart('impulse');
    expect(drive.effect!.at(2)).toBeCloseTo(0.4, 9);
    agrees(drive.formulas![0]!);
  });
});
