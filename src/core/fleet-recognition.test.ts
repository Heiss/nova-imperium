import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  isRecognitionLevel,
  RECOGNITION_DEFAULT,
  RECOGNITION_KEYS,
  RECOGNITION_LEVELS,
  recognitionErrors,
  recognitionOf,
  seenShips,
} from './fleet-recognition.ts';

const SHIPS = { lf: 5, sc: 2 };

describe('the recognition of a foreign fleet (#228)', () => {
  it('has the classic thresholds 2 / 4 / 8 by default (owner, D1)', () => {
    expect(RECOGNITION_DEFAULT).toEqual({ total: 2, types: 4, counts: 8 });
    expect(RECOGNITION_LEVELS).toEqual({ min: 0, max: 100 });
    expect(RECOGNITION_KEYS).toEqual({
      total: 'roundRecognitionTotal',
      types: 'roundRecognitionTypes',
      counts: 'roundRecognitionCounts',
    });
  });

  it('shows below, at and above 2, 4 and 8 only what the level allows', () => {
    const at = (level: number) => seenShips(SHIPS, level, RECOGNITION_DEFAULT);
    expect(at(0)).toEqual({});
    expect(at(1)).toEqual({});
    expect(at(2)).toEqual({ total: 7 });
    expect(at(3)).toEqual({ total: 7 });
    expect(at(4)).toEqual({ total: 7, types: ['lf', 'sc'] });
    expect(at(7)).toEqual({ total: 7, types: ['lf', 'sc'] });
    expect(at(8)).toEqual({ total: 7, types: ['lf', 'sc'], ships: SHIPS });
    expect(at(9)).toEqual({ total: 7, types: ['lf', 'sc'], ships: SHIPS });
  });

  it('invents no zero counts: a type of 0 ships is neither a type nor a count', () => {
    const ships = { lf: 3, sc: 0, hf: 1 };
    expect(seenShips(ships, 8, RECOGNITION_DEFAULT)).toEqual({
      total: 4,
      types: ['lf', 'hf'],
      ships: { lf: 3, hf: 1 },
    });
  });

  it('asks each threshold on its own, also in an unusual order', () => {
    const r = { total: 6, types: 1, counts: 3 };
    expect(seenShips(SHIPS, 0, r)).toEqual({});
    expect(seenShips(SHIPS, 1, r)).toEqual({ types: ['lf', 'sc'] });
    expect(seenShips(SHIPS, 3, r)).toEqual({
      types: ['lf', 'sc'],
      ships: SHIPS,
    });
    expect(seenShips(SHIPS, 6, r)).toEqual({
      total: 7,
      types: ['lf', 'sc'],
      ships: SHIPS,
    });
    // Thresholds of 0: every observer sees everything.
    expect(seenShips(SHIPS, 0, { total: 0, types: 0, counts: 0 })).toEqual({
      total: 7,
      types: ['lf', 'sc'],
      ships: SHIPS,
    });
  });

  it('gives each field exactly from its threshold on (property)', () => {
    const level = fc.integer({ min: 0, max: 100 });
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom('lf', 'hf', 'sc', 'lc', 'probe'),
          fc.integer({ min: 0, max: 1e6 }),
        ),
        level,
        fc.record({ total: level, types: level, counts: level }),
        (ships, l, r) => {
          const seen = seenShips(ships, l, r);
          expect('total' in seen).toBe(l >= r.total);
          expect('types' in seen).toBe(l >= r.types);
          expect('ships' in seen).toBe(l >= r.counts);
          const present = Object.entries(ships).filter(([, n]) => n > 0);
          if (seen.total !== undefined)
            expect(seen.total).toBe(present.reduce((a, [, n]) => a + n, 0));
          if (seen.types) expect(seen.types).toEqual(present.map(([k]) => k));
          if (seen.ships)
            expect(seen.ships).toEqual(Object.fromEntries(present));
        },
      ),
    );
  });

  it('takes whole levels from 0 to 100 as a threshold', () => {
    for (const n of [0, 1, 8, 100]) expect(isRecognitionLevel(n)).toBe(true);
    for (const n of [-1, 101, 2.5, '2', null, undefined, Number.NaN])
      expect(isRecognitionLevel(n)).toBe(false);
  });
});

describe('the thresholds chosen for a new round (#228, X1)', () => {
  const current = { total: 3, types: 5, counts: 9 };

  it('keeps the current thresholds for what the admin does not send', () => {
    for (const input of [undefined, null, {}, 'x', 7]) {
      expect(recognitionErrors(current, input)).toEqual([]);
      expect(recognitionOf(current, input)).toEqual(current);
    }
    expect(recognitionOf(current, { types: 0 })).toEqual({
      total: 3,
      types: 0,
      counts: 9,
    });
    expect(recognitionOf(current, { total: 2, types: 4, counts: 8 })).toEqual(
      RECOGNITION_DEFAULT,
    );
  });

  it('refuses every threshold that is no whole level from 0 to 100, in order', () => {
    expect(recognitionErrors(current, { total: 0, counts: 100 })).toEqual([]);
    expect(
      recognitionErrors(current, { total: -1, types: 2.5, counts: 101 }),
    ).toEqual(['total', 'types', 'counts']);
    expect(recognitionErrors(current, { types: '4' })).toEqual(['types']);
    expect(recognitionErrors(current, { counts: null })).toEqual(['counts']);
  });
});
