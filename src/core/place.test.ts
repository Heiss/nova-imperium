import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parsePlaceId, placeId } from './place.ts';
import type { Place } from './types.ts';

const KINDS = ['planet', 'moon', 'debris'] as const;

const coordinate = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER });
const place: fc.Arbitrary<Place> = fc.record({
  kind: fc.constantFrom(...KINDS),
  g: coordinate,
  s: coordinate,
  p: coordinate,
});

describe('places', () => {
  it('build the id from the kind and the coordinates', () => {
    expect(placeId({ kind: 'planet', g: 2, s: 33, p: 7 })).toBe('p2_33_7');
    expect(placeId({ kind: 'moon', g: 1, s: 2, p: 3 })).toBe('m1_2_3');
    expect(placeId({ kind: 'debris', g: 9, s: 499, p: 15 })).toBe('d9_499_15');
  });

  it('keep the planet ids of before #119', () => {
    expect(placeId({ kind: 'planet', g: 1, s: 1, p: 5 })).toBe('p1_1_5');
  });

  it('give one place per id, and the id back from its place', () => {
    expect(parsePlaceId('p2_33_7')).toEqual({
      kind: 'planet',
      g: 2,
      s: 33,
      p: 7,
    });
    expect(parsePlaceId('m1_2_3')).toEqual({ kind: 'moon', g: 1, s: 2, p: 3 });
    expect(parsePlaceId('d10_20_30')).toEqual({
      kind: 'debris',
      g: 10,
      s: 20,
      p: 30,
    });
    fc.assert(
      fc.property(place, (x) => {
        expect(parsePlaceId(placeId(x))).toEqual(x);
      }),
      { seed: 119 },
    );
  });

  it('refuse every id that is not canonical', () => {
    for (const id of [
      '',
      'p',
      'p1_2',
      'p1_2_3_4',
      'x1_2_3',
      'P1_2_3',
      'p0_2_3',
      'p1_0_3',
      'p1_2_0',
      'p01_2_3',
      'p1_02_3',
      'p1_2_03',
      'p-1_2_3',
      'p1.5_2_3',
      'p1_2_3 ',
      ' p1_2_3',
      'p1_2_3\n',
      'p1__3',
      'p1_2_3x',
      'xp1_2_3',
      'p99999999999999999999_1_1',
      'p1_99999999999999999999_1',
      'p1_1_99999999999999999999',
    ])
      expect(parsePlaceId(id), JSON.stringify(id)).toBeNull();
  });

  it('give an id back unchanged, or null, for any string', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc
            .tuple(
              fc.constantFrom('p', 'm', 'd', 'x', ''),
              fc.stringMatching(/^[0-9]{0,18}$/),
              fc.stringMatching(/^[0-9]{0,4}$/),
              fc.stringMatching(/^[0-9]{0,4}$/),
            )
            .map(([k, g, s, p]) => `${k}${g}_${s}_${p}`),
        ),
        (id) => {
          const x = parsePlaceId(id);
          if (x) expect(placeId(x)).toBe(id);
        },
      ),
      { seed: 119 },
    );
  });
});
