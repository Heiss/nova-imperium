// The activity markers in the browser (#229): the words of the owner
// (2026-11-17, 2026-11-18).
import { describe, expect, it } from 'vitest';
import {
  INACTIVITY_TEXT,
  activityNote,
  activityText,
  inactivityNote,
  NO_ACTIVITY,
  spyActivityText,
} from './activity.ts';

describe('the words of a planet’s activity', () => {
  it('within the first threshold: only „Aktiv“', () => {
    expect(activityText({ recent: true })).toBe('Aktiv');
  });

  it('later: „Aktivität vor x Minuten“', () => {
    expect(activityText({ minutes: 15 })).toBe('Aktivität vor 15 Minuten');
    expect(activityText({ minutes: 59 })).toBe('Aktivität vor 59 Minuten');
    expect(activityText({ minutes: 1 })).toBe('Aktivität vor 1 Minute');
  });

  it('stand after the name, nothing without activity', () => {
    expect(activityNote({ minutes: 20 })).toBe('Aktivität vor 20 Minuten');
    expect(activityNote({ recent: true })).toBe('Aktiv');
    expect(activityNote(undefined)).toBe('');
  });
});

describe('the activity in the Auspex-Bericht (#175 D5, Q3)', () => {
  it('has the words of the Sternenkarte', () => {
    expect(spyActivityText({ recent: true })).toBe('Aktiv');
    expect(spyActivityText({ minutes: 42 })).toBe('Aktivität vor 42 Minuten');
  });
  it('says so without activity, nothing in a report from before', () => {
    expect(NO_ACTIVITY).toBe('Keine Aktivität in der letzten Stunde.');
    expect(spyActivityText(null)).toBe(NO_ACTIVITY);
    expect(spyActivityText(undefined)).toBeNull();
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
