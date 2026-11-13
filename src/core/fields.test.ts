import { describe, expect, it } from 'vitest';
import { planet, seeded, sequence, U } from '../test/fixtures.ts';
import {
  colonyDiameter,
  fieldRange,
  fieldsFull,
  fieldsOf,
  HOME_DIAMETER,
  maxFields,
  minDiameter,
  usedFields,
} from './fields.ts';

// The wiki table of the owner's decision (okf/features/fields.md, #51).
const TABLE: Record<number, [number, number]> = {
  1: [96, 172],
  2: [104, 176],
  3: [112, 182],
  4: [118, 208],
  5: [133, 232],
  6: [146, 242],
  7: [152, 248],
  8: [156, 252],
  9: [150, 246],
  10: [142, 232],
  11: [136, 210],
  12: [125, 186],
  13: [114, 172],
  14: [100, 168],
  15: [90, 164],
};

describe('fields of a diameter (#51)', () => {
  it('are the square of the diameter in thousands of km, rounded down', () => {
    expect(fieldsOf(12800)).toBe(163);
    expect(fieldsOf(10000)).toBe(100);
    expect(fieldsOf(9999)).toBe(99);
    expect(fieldsOf(12767)).toBe(162);
    expect(fieldsOf(12768)).toBe(163);
    expect(fieldsOf(0)).toBe(0);
  });

  it('gives the home planet 163 fields', () => {
    expect(HOME_DIAMETER).toBe(12800);
    expect(fieldsOf(HOME_DIAMETER)).toBe(163);
  });

  it('finds the smallest diameter with a number of fields', () => {
    expect(minDiameter(100)).toBe(10000);
    expect(minDiameter(163)).toBe(12768);
    for (let f = 1; f <= 400; f++) {
      expect(fieldsOf(minDiameter(f)), String(f)).toBe(f);
      expect(fieldsOf(minDiameter(f) - 1), String(f)).toBe(f - 1);
    }
  });
});

describe('field range of a position (#51)', () => {
  it('is the wiki table for positions 1 to 15', () => {
    for (const [p, [min, max]] of Object.entries(TABLE))
      expect(fieldRange(Number(p)), p).toEqual({ min, max });
  });

  it('uses the range of position 15 for positions 16 to 20', () => {
    for (let p = 16; p <= 20; p++)
      expect(fieldRange(p)).toEqual({ min: 90, max: 164 });
  });

  it('clamps positions outside the universe', () => {
    expect(fieldRange(0)).toEqual({ min: 96, max: 172 });
    expect(fieldRange(-3)).toEqual({ min: 96, max: 172 });
    expect(fieldRange(99)).toEqual({ min: 90, max: 164 });
  });
});

describe('diameter of a colony (#51)', () => {
  it('has fields chosen at random within the range of its position', () => {
    const rng = seeded(51);
    for (let p = 1; p <= 20; p++) {
      const { min, max } = fieldRange(p);
      const seen = new Set<number>();
      for (let i = 0; i < 400; i++) {
        const fields = fieldsOf(colonyDiameter(p, rng));
        expect(fields).toBeGreaterThanOrEqual(min);
        expect(fields).toBeLessThanOrEqual(max);
        seen.add(fields);
      }
      // Uniform over the range: 400 draws hit most of the values.
      expect(seen.size).toBeGreaterThan((max - min) / 2);
    }
  });

  it('reaches both ends of the range', () => {
    expect(colonyDiameter(15, sequence([0, 0]))).toBe(minDiameter(90));
    expect(colonyDiameter(15, sequence([0.9999999, 0.9999999]))).toBe(
      minDiameter(165) - 1,
    );
    expect(fieldsOf(colonyDiameter(8, sequence([0.9999999, 0])))).toBe(252);
    expect(fieldsOf(colonyDiameter(8, sequence([0, 0.9999999])))).toBe(156);
  });

  it('draws the field count first, then the diameter within it', () => {
    // Half way through the range of position 1: 96 + floor(0.5 · 77) = 134.
    const d = colonyDiameter(1, sequence([0.5, 0.5]));
    expect(fieldsOf(d)).toBe(134);
    const lo = minDiameter(134);
    const hi = minDiameter(135);
    expect(d).toBe(lo + Math.floor(0.5 * (hi - lo)));
  });

  it('is the same for the same seed', () => {
    const a = seeded(7);
    const b = seeded(7);
    for (let i = 0; i < 20; i++)
      expect(colonyDiameter(i, a)).toBe(colonyDiameter(i, b));
  });
});

describe('used and maximal fields (#51)', () => {
  it('counts one field per building level', () => {
    expect(usedFields(planet())).toBe(0);
    expect(usedFields(planet({ b: { metal: 10, lab: 3, robot: 2 } }))).toBe(15);
  });

  it('are the fields of the diameter plus the extra fields of the universe', () => {
    const p = planet({ diameter: HOME_DIAMETER });
    expect(maxFields(p, U)).toBe(163);
    expect(maxFields(p, { ...U, extraFields: 25 })).toBe(188);
    expect(maxFields(planet({ diameter: 10000 }), U)).toBe(100);
  });

  it('grow by five per level of the Weltenschmiede, which takes a field itself', () => {
    const p = planet({ diameter: HOME_DIAMETER, b: { terraformer: 3 } });
    expect(maxFields(p, U)).toBe(163 + 15);
    expect(usedFields(p)).toBe(3);
    expect(maxFields(p, { ...U, extraFields: 2 })).toBe(163 + 15 + 2);
  });

  it('ignore unknown building keys for the maximum', () => {
    const p = planet({ diameter: 10000, b: { nope: 4, toString: 2 } });
    expect(maxFields(p, U)).toBe(100);
    expect(usedFields(p)).toBe(6);
  });

  it('have no limit on a planet from before the fields', () => {
    const p = planet({ unlimited: true, b: { metal: 400 } });
    expect(maxFields(p, U)).toBeNull();
    expect(fieldsFull(p, U)).toBe(false);
  });

  it('are full when every field is taken', () => {
    const p = planet({ diameter: 10000, b: { metal: 99 } });
    expect(fieldsFull(p, U)).toBe(false);
    expect(fieldsFull({ ...p, b: { metal: 99, lab: 1 } }, U)).toBe(true);
    expect(fieldsFull({ ...p, b: { metal: 120 } }, U)).toBe(true);
    expect(
      fieldsFull({ ...p, b: { metal: 100 } }, { ...U, extraFields: 1 }),
    ).toBe(false);
    expect(fieldsFull({ ...p, b: { metal: 100, terraformer: 1 } }, U)).toBe(
      false,
    );
  });
});
