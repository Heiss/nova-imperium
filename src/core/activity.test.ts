// The rules of the public activity markers (#229, owner, 2026-11-16 and
// 2026-11-17): which events set activity where, the classic thresholds and
// their boundaries, the per-round values of the admin.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_DEFAULT,
  ACTIVITY_MINUTES_SETTING,
  ACTIVITY_RANGE,
  ACTIVITY_RECENT_SETTING,
  type ActivityEvent,
  DAY_MS,
  INACTIVE_DAYS_SETTING,
  LONG_INACTIVE_DAYS_SETTING,
  MINUTE_MS,
  activityLimits,
  activityPlaces,
  inactivity,
  planetActivity,
} from './activity.ts';
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundRefused,
  roundValues,
} from './round.ts';
import { liveSpecs } from './universe.ts';

const NOW = 1_763_300_000_000;
const C = ACTIVITY_DEFAULT;
const own = ['p1_2_3', 'm1_2_3', 'p2_5_9'];

const SETTINGS = [
  ACTIVITY_RECENT_SETTING,
  ACTIVITY_MINUTES_SETTING,
  INACTIVE_DAYS_SETTING,
  LONG_INACTIVE_DAYS_SETTING,
];

describe('the thresholds of a round', () => {
  it('are the classic values by default: 15 min, 59 min, 7 and 28 days', () => {
    expect(ACTIVITY_DEFAULT).toEqual({
      recent: 15,
      minutes: 59,
      inactive: 7,
      longInactive: 28,
    });
    expect(MINUTE_MS).toBe(60 * 1000);
    expect(DAY_MS).toBe(24 * 60 * MINUTE_MS);
  });

  it('take whole numbers of their range only', () => {
    expect(ACTIVITY_RANGE).toEqual({
      recent: { min: 1, max: 60 },
      minutes: { min: 1, max: 1440 },
      inactive: { min: 1, max: 365 },
      longInactive: { min: 1, max: 365 },
    });
  });

  it('are four settings of the round, live in the universe settings (#283, X1)', () => {
    const group = { name: 'activity', legend: 'Aktivität' };
    const common = { kind: 'number', group, live: true };
    expect(SETTINGS).toEqual([
      {
        ...common,
        key: 'roundActivityRecent',
        name: 'activityRecent',
        label: 'Aktivität ohne Minutenangabe (Minuten)',
        order: 60,
        min: 1,
        max: 60,
        def: 15,
      },
      {
        ...common,
        key: 'roundActivityMinutes',
        name: 'activityMinutes',
        label: 'Aktivität mit Minutenangabe bis (Minuten)',
        order: 70,
        min: 1,
        max: 1440,
        def: 59,
      },
      {
        ...common,
        key: 'roundInactiveDays',
        name: 'inactiveDays',
        label: 'Inaktiv ab (Tage)',
        order: 80,
        min: 1,
        max: 365,
        def: 7,
      },
      {
        ...common,
        key: 'roundLongInactiveDays',
        name: 'longInactiveDays',
        label: 'Lange inaktiv ab (Tage)',
        order: 90,
        min: 1,
        max: 365,
        def: 28,
      },
    ]);
    // One group, so they are sent and refused together.
    for (const s of SETTINGS) expect(s.group).toBe(SETTINGS[0]!.group);
    // The registry holds them in this order, picked by their group, so a
    // later feature after them (#228: 120 to 140) does not matter.
    expect(
      ROUND_SETTINGS.filter((s: RoundSetting) => s.group?.name === 'activity'),
    ).toEqual(SETTINGS);
    const keys = new Set<string>(SETTINGS.map((s) => s.key));
    expect(
      liveSpecs()
        .filter((s) => keys.has(s.key))
        .map((s) => s.key),
    ).toEqual(SETTINGS.map((s) => s.key));
  });

  it('are read from the rules of the round', () => {
    expect(
      activityLimits({
        activityRecent: 10,
        activityMinutes: 30,
        inactiveDays: 5,
        longInactiveDays: 20,
      }),
    ).toEqual({ recent: 10, minutes: 30, inactive: 5, longInactive: 20 });
  });
});

describe('the thresholds chosen for a new round', () => {
  const current = {
    activityRecent: 10,
    activityMinutes: 30,
    inactiveDays: 5,
    longInactiveDays: 20,
  };

  it('keep the current values when they are not sent', () => {
    expect(roundRefused(current, {}, SETTINGS)).toEqual([]);
    expect(roundValues(current, {}, SETTINGS)).toEqual(current);
  });

  it('report every wrong value at once, in their order', () => {
    const wrong = (activity: unknown) =>
      roundRefused(current, { activity }, SETTINGS).map((s) => s.name);
    expect(
      wrong({
        activityRecent: 0,
        activityMinutes: 1441,
        inactiveDays: 2.5,
        longInactiveDays: '28',
      }),
    ).toEqual([
      'activityRecent',
      'activityMinutes',
      'inactiveDays',
      'longInactiveDays',
    ]);
    expect(wrong({ ...current, inactiveDays: 366 })).toEqual(['inactiveDays']);
    expect(wrong({ ...current, activityRecent: 61 })).toEqual([
      'activityRecent',
    ]);
    const edge = {
      activityRecent: 60,
      activityMinutes: 1440,
      inactiveDays: 365,
      longInactiveDays: 1,
    };
    expect(wrong(edge)).toEqual([]);
    expect(roundValues(current, { activity: edge }, SETTINGS)).toEqual(edge);
  });
});

describe('what sets activity (v0.76d with v0.77b)', () => {
  it('a login: only the main planet', () => {
    expect(activityPlaces('login', own, 'p2_5_9')).toEqual(['p2_5_9']);
    expect(activityPlaces('login', own, null)).toEqual([]);
  });

  it('a manual action: every own planet and moon', () => {
    expect(activityPlaces('action', own, 'p2_5_9')).toEqual(own);
    expect(activityPlaces('action', [], null)).toEqual([]);
    const copy = activityPlaces('action', own, null);
    copy.pop();
    expect(own).toHaveLength(3);
  });

  it('fleets, spying and finished buildings: nothing', () => {
    const none: ActivityEvent[] = [
      'fleetSent',
      'fleetArrived',
      'fleetRecalled',
      'fleetReturned',
      'spied',
      'buildingDone',
    ];
    for (const event of none)
      expect(activityPlaces(event, own, 'p1_2_3')).toEqual([]);
  });
});

describe('the activity of a planet', () => {
  const ago = (ms: number) => planetActivity(NOW - ms, NOW, C);

  it('is recent within the first 15 minutes, without the minutes', () => {
    expect(ago(0)).toEqual({ recent: true });
    expect(ago(14 * MINUTE_MS + 59_999)).toEqual({ recent: true });
    // A time after now (clocks) counts as now.
    expect(ago(-5 * MINUTE_MS)).toEqual({ recent: true });
  });

  it('shows the whole minutes from 15 up to 59', () => {
    expect(ago(15 * MINUTE_MS)).toEqual({ minutes: 15 });
    expect(ago(30 * MINUTE_MS + 59_999)).toEqual({ minutes: 30 });
    expect(ago(59 * MINUTE_MS + 59_999)).toEqual({ minutes: 59 });
  });

  it('is nothing after an hour', () => {
    expect(ago(60 * MINUTE_MS)).toBeNull();
    expect(ago(3 * DAY_MS)).toBeNull();
  });

  it('follows the thresholds of the round', () => {
    const limits = { ...C, recent: 5, minutes: 120 };
    expect(planetActivity(NOW - 4 * MINUTE_MS, NOW, limits)).toEqual({
      recent: true,
    });
    expect(planetActivity(NOW - 5 * MINUTE_MS, NOW, limits)).toEqual({
      minutes: 5,
    });
    expect(planetActivity(NOW - 120 * MINUTE_MS, NOW, limits)).toEqual({
      minutes: 120,
    });
    expect(planetActivity(NOW - 121 * MINUTE_MS, NOW, limits)).toBeNull();
    // A minute limit below the recent time shows no minutes at all.
    const short = { ...C, recent: 20, minutes: 10 };
    expect(planetActivity(NOW - 19 * MINUTE_MS, NOW, short)).toEqual({
      recent: true,
    });
    expect(planetActivity(NOW - 20 * MINUTE_MS, NOW, short)).toBeNull();
  });

  it('never shows minutes inside the recent time or beyond the limit (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 * DAY_MS }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 1, max: 1440 }),
        (ms, recent, minutes) => {
          const a = planetActivity(NOW - ms, NOW, { ...C, recent, minutes });
          const m = Math.floor(ms / MINUTE_MS);
          if (a === null) return m >= recent && m > minutes;
          if ('recent' in a) return m < recent;
          return a.minutes === m && m >= recent && m <= minutes;
        },
      ),
    );
  });
});

describe('the inactivity of an account', () => {
  const ago = (ms: number) => inactivity(NOW - ms, NOW, C);

  it('is nothing for up to 7 days', () => {
    expect(ago(0)).toBeNull();
    expect(ago(7 * DAY_MS - 1)).toBeNull();
  });

  it('is inactive from 7 days on', () => {
    expect(ago(7 * DAY_MS)).toBe('inactive');
    expect(ago(28 * DAY_MS - 1)).toBe('inactive');
  });

  it('is long inactive from 28 days on', () => {
    expect(ago(28 * DAY_MS)).toBe('long');
    expect(ago(400 * DAY_MS)).toBe('long');
  });

  it('follows the thresholds of the round', () => {
    const limits = { ...C, inactive: 2, longInactive: 3 };
    expect(inactivity(NOW - 2 * DAY_MS + 1, NOW, limits)).toBeNull();
    expect(inactivity(NOW - 2 * DAY_MS, NOW, limits)).toBe('inactive');
    expect(inactivity(NOW - 3 * DAY_MS, NOW, limits)).toBe('long');
    // Long inactive below inactive: long counts first.
    const swapped = { ...C, inactive: 10, longInactive: 5 };
    expect(inactivity(NOW - 5 * DAY_MS, NOW, swapped)).toBe('long');
    expect(inactivity(NOW - 4 * DAY_MS, NOW, swapped)).toBeNull();
  });
});
