// The activity markers in the browser (#229): the words of the owner
// (2026-11-17) and the thresholds of the dialog „Neue Runde“ (X1).
import { describe, expect, it } from 'vitest';
import { ACTIVITY_DEFAULT } from '../../core/activity.ts';
import {
  ACTIVITY_INPUTS,
  INACTIVITY_TEXT,
  activityMark,
  activityNumbers,
  activityText,
  inactivityMark,
  NO_ACTIVITY,
  spyActivityText,
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
    const round = { activity: { ...ACTIVITY_DEFAULT, recent: 10 } };
    expect(activityMark({ minutes: 20 }, round)).toBe(
      ' <span class="dim">(Aktivität vor 20 Minuten)</span>',
    );
    expect(activityMark({ recent: true }, round)).toBe(
      ' <span class="dim">(Aktivität vor weniger als 10 Minuten)</span>',
    );
    expect(activityMark(undefined, round)).toBe('');
  });
});

describe('the activity in the Auspex-Bericht (#175 D5, Q3)', () => {
  const round = { activity: { ...ACTIVITY_DEFAULT } };
  it('has the words of the Sternenkarte', () => {
    expect(spyActivityText({ recent: true }, round)).toBe(
      'Aktivität vor weniger als 15 Minuten',
    );
    expect(spyActivityText({ minutes: 42 }, round)).toBe(
      'Aktivität vor 42 Minuten',
    );
  });
  it('says so without activity, nothing in a report from before', () => {
    expect(NO_ACTIVITY).toBe('Keine Aktivität in der letzten Stunde.');
    expect(spyActivityText(null, round)).toBe(NO_ACTIVITY);
    expect(spyActivityText(undefined, round)).toBeNull();
  });
});

describe('the words of an account’s inactivity', () => {
  it('are „Inaktiv“ and „Lange inaktiv“', () => {
    expect(INACTIVITY_TEXT).toEqual({
      inactive: 'Inaktiv',
      long: 'Lange inaktiv',
    });
    expect(inactivityMark('inactive')).toBe(
      ' <span class="dim">(Inaktiv)</span>',
    );
    expect(inactivityMark('long')).toBe(
      ' <span class="dim">(Lange inaktiv)</span>',
    );
    expect(inactivityMark(undefined)).toBe('');
  });
});

describe('the thresholds of the dialog „Neue Runde“', () => {
  it('stand for the settings of the universe, in their order', () => {
    expect(
      ACTIVITY_INPUTS.map((i) => [i.part, i.id, i.spec.key, i.spec.def]),
    ).toEqual([
      ['recent', 'round-activity-recent', 'roundActivityRecent', 15],
      ['minutes', 'round-activity-minutes', 'roundActivityMinutes', 59],
      ['inactive', 'round-activity-inactive', 'roundInactiveDays', 7],
      [
        'longInactive',
        'round-activity-longInactive',
        'roundLongInactiveDays',
        28,
      ],
    ]);
  });

  it('are sent as numbers, an empty field as none', () => {
    const fields: Record<string, string> = {
      '#round-activity-recent': '10',
      '#round-activity-minutes': ' ',
      '#round-activity-inactive': '2.5',
      '#round-activity-longInactive': 'x',
    };
    expect(activityNumbers((sel) => fields[sel] ?? '')).toEqual({
      recent: 10,
      minutes: null,
      inactive: 2.5,
      longInactive: Number.NaN,
    });
  });
});
