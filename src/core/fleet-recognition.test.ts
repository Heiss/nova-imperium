import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RECOGNITION_COUNTS_SETTING,
  RECOGNITION_DEFAULT,
  RECOGNITION_LEVELS,
  RECOGNITION_TOTAL_SETTING,
  RECOGNITION_TYPES_SETTING,
  recognitionOf,
  seenShips,
} from './fleet-recognition.ts';
import { roundRefused, roundRequest, roundValues } from './round.ts';

const SHIPS = { lf: 5, sc: 2 };

describe('the recognition of a foreign fleet (#228)', () => {
  it('has the classic thresholds 2 / 4 / 8 by default (owner, D1)', () => {
    expect(RECOGNITION_DEFAULT).toEqual({ total: 2, types: 4, counts: 8 });
    expect(RECOGNITION_LEVELS).toEqual({ min: 0, max: 100 });
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
});

describe('the thresholds as settings of the round (#228, D1, X1; #283)', () => {
  const SETTINGS = [
    RECOGNITION_TOTAL_SETTING,
    RECOGNITION_TYPES_SETTING,
    RECOGNITION_COUNTS_SETTING,
  ];
  const current = {
    recognitionTotal: 3,
    recognitionTypes: 5,
    recognitionCounts: 9,
  };
  const refused = (recognition: unknown): string[] =>
    roundRefused(current, { recognition }, SETTINGS).map((s) => s.name);

  it('are three live number fields of one group without a legend, after the orders of #229 and #55', () => {
    const group = { name: 'recognition' };
    const common = { kind: 'number', min: 0, max: 100, live: true, group };
    expect(SETTINGS).toEqual([
      {
        ...common,
        key: 'roundRecognitionTotal',
        name: 'recognitionTotal',
        label: 'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre',
        order: 120,
        def: 2,
      },
      {
        ...common,
        key: 'roundRecognitionTypes',
        name: 'recognitionTypes',
        label: 'Fremde Flotten: Schiffstypen ab Auspex-Lehre',
        order: 130,
        def: 4,
      },
      {
        ...common,
        key: 'roundRecognitionCounts',
        name: 'recognitionCounts',
        label: 'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre',
        order: 140,
        def: 8,
      },
    ]);
    // One group object, so the three are sent and refused together.
    for (const s of SETTINGS)
      expect(s.group).toBe(RECOGNITION_TOTAL_SETTING.group);
  });

  it('are the thresholds of the round by part', () => {
    expect(recognitionOf(current)).toEqual({ total: 3, types: 5, counts: 9 });
    expect(
      recognitionOf({
        recognitionTotal: 2,
        recognitionTypes: 4,
        recognitionCounts: 8,
      }),
    ).toEqual(RECOGNITION_DEFAULT);
  });

  it('keep the current thresholds when the admin sends none', () => {
    expect(refused(undefined)).toEqual([]);
    expect(roundValues(current, {}, SETTINGS)).toEqual(current);
    const sent = {
      recognitionTotal: 0,
      recognitionTypes: 100,
      recognitionCounts: 8,
    };
    expect(refused(sent)).toEqual([]);
    expect(roundValues(current, { recognition: sent }, SETTINGS)).toEqual(sent);
    expect(roundRequest(sent, SETTINGS)).toEqual({ recognition: sent });
  });

  it('refuse every threshold that is no whole level from 0 to 100, in order', () => {
    expect(
      refused({
        recognitionTotal: -1,
        recognitionTypes: 2.5,
        recognitionCounts: 101,
      }),
    ).toEqual(['recognitionTotal', 'recognitionTypes', 'recognitionCounts']);
    expect(
      refused({
        recognitionTotal: 2,
        recognitionTypes: '4',
        recognitionCounts: 8,
      }),
    ).toEqual(['recognitionTypes']);
    expect(
      refused({
        recognitionTotal: 2,
        recognitionTypes: 4,
        recognitionCounts: null,
      }),
    ).toEqual(['recognitionCounts']);
  });
});
