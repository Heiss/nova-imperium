// The activity markers in the browser (#229): the words of the owner
// (2026-11-17), worded with the round's threshold.
import { describe, expect, it } from 'vitest';
import {
  INACTIVITY_TEXT,
  activityNote,
  activityText,
  inactivityNote,
} from './activity.ts';

const limits = { recent: 15 };

describe('the words of a planet’s activity', () => {
  it('within the first minutes: without the exact minutes', () => {
    expect(activityText({ recent: true }, limits)).toBe(
      'Aktivität vor weniger als 15 Minuten',
    );
    expect(activityText({ recent: true }, { recent: 1 })).toBe(
      'Aktivität vor weniger als 1 Minute',
    );
  });

  it('later: „Aktivität vor x Minuten“', () => {
    expect(activityText({ minutes: 15 }, limits)).toBe(
      'Aktivität vor 15 Minuten',
    );
    expect(activityText({ minutes: 59 }, limits)).toBe(
      'Aktivität vor 59 Minuten',
    );
    expect(activityText({ minutes: 1 }, limits)).toBe('Aktivität vor 1 Minute');
  });

  it('stand after the name, nothing without activity', () => {
    const round = { activityRecent: 10 };
    expect(activityNote({ minutes: 20 }, round)).toBe(
      'Aktivität vor 20 Minuten',
    );
    expect(activityNote({ recent: true }, round)).toBe(
      'Aktivität vor weniger als 10 Minuten',
    );
    expect(activityNote(undefined, round)).toBe('');
  });
});

describe('the words of an account’s inactivity', () => {
  it('are „Inaktiv“ and „Lange inaktiv“', () => {
    expect(INACTIVITY_TEXT).toEqual({
      inactive: 'Inaktiv',
      long: 'Lange inaktiv',
    });
    expect(inactivityNote('inactive')).toBe('Inaktiv');
    expect(inactivityNote('long')).toBe('Lange inaktiv');
    expect(inactivityNote(undefined)).toBe('');
  });
});
