import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import { diameterLine, fieldsLine } from './fields.ts';

const home = planet({
  diameter: 12800,
  b: { metal: 30, crystal: 20, lab: 4 },
});

describe('fields in the interface (#51)', () => {
  it('show the taken and all fields on the buildings page', () => {
    expect(fieldsLine(home, U)).toBe('Felder: 54 / 163');
    expect(fieldsLine(planet({ diameter: 12800 }), U)).toBe('Felder: 0 / 163');
    expect(fieldsLine(home, { extraFields: 7 })).toBe('Felder: 54 / 170');
    expect(fieldsLine({ ...home, b: { ...home.b, terraformer: 2 } }, U)).toBe(
      'Felder: 56 / 173',
    );
  });

  it('show the diameter with the fields in the overview', () => {
    expect(diameterLine(home, U)).toBe('12.800 km (54/163 Felder)');
    expect(diameterLine(planet({ diameter: 9487 }), U)).toBe(
      '9.487 km (0/90 Felder)',
    );
  });

  it('say „unbegrenzt“ for a planet from before the fields', () => {
    const old = { ...home, diameter: 14254, unlimited: true };
    expect(fieldsLine(old, U)).toBe('Felder: 54 / unbegrenzt');
    expect(diameterLine(old, U)).toBe('14.254 km (54 Felder, unbegrenzt)');
  });

  it('group large numbers the German way', () => {
    const big = planet({ diameter: 40000, b: { metal: 1200 } });
    expect(fieldsLine(big, U)).toBe('Felder: 1.200 / 1.600');
    expect(diameterLine(big, U)).toBe('40.000 km (1.200/1.600 Felder)');
  });
});
