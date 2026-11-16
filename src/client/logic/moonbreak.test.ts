// The lines of a Mondbruch in the battle report (#95; owner, 2026-11-13, the
// decided wording).
import { describe, expect, it } from 'vitest';
import { chanceText, moonbreakLines } from './moonbreak.ts';

const rolls = (over: Record<string, unknown> = {}) => ({
  chance: 36.754,
  broken: false,
  loss: 31.6227,
  lost: false,
  ...over,
});

describe('the Mondbruch in the battle report', () => {
  it('shows a chance in German with at most two decimals', () => {
    expect(chanceText(36.754)).toBe('36,75');
    expect(chanceText(31.6227)).toBe('31,62');
    expect(chanceText(100)).toBe('100');
    expect(chanceText(40.5)).toBe('40,5');
  });

  it('says whether the moon broke or holds, with its chance', () => {
    expect(moonbreakLines({ moonbreak: rolls({ broken: true }) })).toEqual([
      'Der Mond ist zerbrochen (Chance 36,75 %).',
    ]);
    expect(moonbreakLines({ moonbreak: rolls() })).toEqual([
      'Der Mond hält stand (Chance 36,75 %).',
    ]);
  });

  it('says when the Weltenbrecher were torn apart, with their chance', () => {
    expect(
      moonbreakLines({ moonbreak: rolls({ broken: true, lost: true }) }),
    ).toEqual([
      'Der Mond ist zerbrochen (Chance 36,75 %).',
      'Die Weltenbrecher wurden vom eigenen Schuss zerrissen (Chance 31,62 %).',
    ]);
    expect(moonbreakLines({ moonbreak: rolls({ lost: true }) })).toEqual([
      'Der Mond hält stand (Chance 36,75 %).',
      'Die Weltenbrecher wurden vom eigenen Schuss zerrissen (Chance 31,62 %).',
    ]);
  });

  it('tells the owner that his moon is gone', () => {
    expect(
      moonbreakLines({ moonLost: true, coords: { g: 1, s: 2, p: 6 } }),
    ).toEqual(['Dein Mond bei [1:2:6] wurde zerstört.']);
    expect(
      moonbreakLines({ moonLost: 'yes', coords: { g: 1, s: 2, p: 6 } }),
    ).toEqual([]);
  });

  it('shows nothing for a report without a Mondbruch or with broken data', () => {
    expect(moonbreakLines({})).toEqual([]);
    expect(moonbreakLines({ moonbreak: null })).toEqual([]);
    expect(moonbreakLines({ moonbreak: 'x' })).toEqual([]);
    expect(moonbreakLines({ moonbreak: rolls({ chance: '5' }) })).toEqual([]);
    expect(moonbreakLines({ moonbreak: rolls({ loss: undefined }) })).toEqual(
      [],
    );
  });
});
