// The numbers of the dialog „Neue Runde“: the lock of the main planet (#221)
// and the thresholds of foreign fleets (#228, X1), read by their inputs.
import { describe, expect, it } from 'vitest';
import { RECOGNITION_INPUTS, roundNumbers } from './round.ts';

describe('the numbers of the dialog „Neue Runde“', () => {
  it('names each threshold of foreign fleets as the universe settings do', () => {
    expect(
      RECOGNITION_INPUTS.map((i) => [i.part, i.id, i.spec.key, i.spec.label]),
    ).toEqual([
      [
        'total',
        'round-recognition-total',
        'roundRecognitionTotal',
        'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre',
      ],
      [
        'types',
        'round-recognition-types',
        'roundRecognitionTypes',
        'Fremde Flotten: Schiffstypen ab Auspex-Lehre',
      ],
      [
        'counts',
        'round-recognition-counts',
        'roundRecognitionCounts',
        'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre',
      ],
    ]);
  });

  it('reads the lock and the thresholds as numbers', () => {
    const inputs: Record<string, string> = {
      '#round-main-lock': '7',
      '#round-recognition-total': '0',
      '#round-recognition-types': '4',
      '#round-recognition-counts': '12',
    };
    expect(roundNumbers((sel) => inputs[sel] ?? '')).toEqual({
      mainLock: 7,
      recognition: { total: 0, types: 4, counts: 12 },
    });
  });

  it('sends an empty field as no number, so the server refuses it', () => {
    expect(roundNumbers(() => ' ')).toEqual({
      mainLock: null,
      recognition: { total: null, types: null, counts: null },
    });
    expect(roundNumbers(() => '2.5').recognition.total).toBe(2.5);
  });
});
