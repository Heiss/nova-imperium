import { describe, expect, it } from 'vitest';
import { U } from '../../test/fixtures.ts';
import { techFactor } from '../battle.ts';
import { BUILD, RES } from '../catalog.ts';
import { capOf } from '../components/storage.ts';
import { growth } from '../rates.ts';
import { fill } from './links.ts';
import {
  costFormula,
  drivePart,
  growthValues,
  number,
  percent,
  storageFormula,
  storePart,
  techPart,
} from './parts.ts';
import type { EntryLexicon, Formula } from './types.ts';

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
    const tech = techPart('weapons', 'attack', 'Angriff', 'den Angriff');
    expect(tech.effect!.at(3)).toBeCloseTo(0.3, 9);
    expect(tech.effect!.label).toBe('Angriff');
    agrees(tech.formulas![0]!);
    const drive = drivePart('impulse');
    expect(drive.effect!.at(2)).toBeCloseTo(0.4, 9);
    agrees(drive.formulas![0]!);
  });

  it('fills the texts before the formulas from the rules ([V], 2026-11-17)', () => {
    const read = (part: { texts?: EntryLexicon['texts'] }): string =>
      fill(part.texts![0]!.text, part.texts![0]!.values);
    // „doppelt so hoch“ at the level the text names.
    const tech = techPart('weapons', 'attack', 'Angriff', 'den Angriff');
    expect(read(tech)).toContain('hebt den Angriff aller deiner Schiffe');
    expect(read(tech)).toContain('um 10 % des Grundwerts');
    expect(read(tech)).toContain('Mit Stufe 10 ist der Wert doppelt so hoch');
    expect(techFactor(10)).toBe(2);
    expect(read(drivePart('impulse'))).toContain(
      'legt 20 % des Grundtempos obendrauf',
    );
    expect(read(drivePart('impulse'))).toContain('Stufe 5 bringt 100 %');
    // A store: what the levels add to the base store of any universe.
    const store = read(storePart());
    for (const [level, words] of [
      [1, 'Die erste Stufe bringt 50.000 dazu'],
      [2, 'die zweite insgesamt 100.000'],
      [3, 'die dritte 200.000'],
      [10, 'Stufe 10 bringt schon 5.450.000'],
    ] as const) {
      expect(store).toContain(words);
      expect(capOf(level, U) - capOf(0, U)).toBe(
        capOf(level, { baseStore: 0 }),
      );
    }
    expect(capOf(1, { baseStore: 0 })).toBe(50000);
    // The growth of a mine: l · 1.1^l.
    expect(growthValues).toEqual({
      step: '10 %',
      low: '5',
      high: '10',
      times: '3,2',
    });
    expect(growth(10) / growth(5)).toBeCloseTo(3.22, 2);
  });
});
