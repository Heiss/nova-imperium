// The settings of a round (#214, #283): the registry, both reward options
// and the guild switch are yes or no, the locks of the main planet and of
// a given-up position (#224) and the thresholds of the activity markers
// (#229) whole numbers; an option not sent keeps the current one.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundFieldId,
  roundRefused,
  roundRequest,
  roundValues,
  storedValues,
} from './round.ts';

/** The classic thresholds of the activity markers (#229). */
const activity = {
  activityRecent: 15,
  activityMinutes: 59,
  inactiveDays: 7,
  longInactiveDays: 28,
};

/** The thresholds of foreign fleets (#228) at their defaults. */
const RECOGNITION = {
  recognitionTotal: 2,
  recognitionTypes: 4,
  recognitionCounts: 8,
};
const current = {
  ...RECOGNITION,
  abandonLock: 24,
  achievements: true,
  daily: false,
  guilds: true,
  mainLock: 7,
  ...activity,
  vacationHours: 24,
};
const both = { achievements: false, daily: true };

/** The names of the refused settings, as the old codes: rewards, guilds. */
const refused = (
  rewards: unknown,
  guilds: unknown,
  mainLock?: unknown,
  abandonLock?: unknown,
  vacationHours?: unknown,
): string[] =>
  roundRefused(current, {
    rewards,
    guilds,
    mainLock,
    abandonLock,
    vacationHours,
  }).map((s) => s.group?.name ?? s.name);

const code = (rewards: unknown, guilds: unknown): string | null =>
  refused(rewards, guilds)[0] ?? null;

describe('the registry of the round settings', () => {
  it('holds the settings of main in the fixed order of their numbers, with unique numbers, keys and names', () => {
    // Owner, 2026-11-17: the order of main before #283; a new one is last.
    expect(ROUND_SETTINGS.map((s) => [s.order, s.key, s.name])).toEqual([
      [10, 'roundAchievements', 'achievements'],
      [20, 'roundDaily', 'daily'],
      [30, 'roundGuilds', 'guilds'],
      [40, 'roundMainLock', 'mainLock'],
      [50, 'roundAbandonLock', 'abandonLock'],
      [60, 'roundActivityRecent', 'activityRecent'],
      [70, 'roundActivityMinutes', 'activityMinutes'],
      [80, 'roundInactiveDays', 'inactiveDays'],
      [90, 'roundLongInactiveDays', 'longInactiveDays'],

      // #228: 100 and 110 are left to #55.
      [120, 'roundRecognitionTotal', 'recognitionTotal'],
      [130, 'roundRecognitionTypes', 'recognitionTypes'],
      [140, 'roundRecognitionCounts', 'recognitionCounts'],
      // #223, after the numbers 60 to 140 of the open branches.
      [150, 'roundVacationHours', 'vacationHours'],
    ]);
    const orders = ROUND_SETTINGS.map((s) => s.order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(orders.every((o) => Number.isInteger(o) && o > 0)).toBe(true);
    const keys = ROUND_SETTINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ROUND_SETTINGS.map((s) => s.name)).size).toBe(keys.length);
  });

  it('keeps the members of a group together, a default and choices in the range', () => {
    const settings: readonly RoundSetting[] = ROUND_SETTINGS;
    for (const [i, s] of settings.entries()) {
      const before = settings.slice(0, i).map((x) => x.group);
      if (s.group && before.includes(s.group))
        expect(settings[i - 1]!.group).toBe(s.group);
      if (s.kind === 'number') {
        expect(Number.isInteger(s.def)).toBe(true);
        expect(s.def).toBeGreaterThanOrEqual(s.min);
        expect(s.def).toBeLessThanOrEqual(s.max);
        for (const c of s.choices ?? []) {
          expect(c.value).toBeGreaterThanOrEqual(s.min);
          expect(c.value).toBeLessThanOrEqual(s.max);
        }
      }
    }
  });

  it('names the field of the dialog after the setting', () => {
    expect(ROUND_SETTINGS.map(roundFieldId)).toEqual([
      'round-achievements',
      'round-daily',
      'round-guilds',
      'round-main-lock',
      'round-abandon-lock',
      'round-activity-recent',
      'round-activity-minutes',
      'round-inactive-days',
      'round-long-inactive-days',

      'round-recognition-total',
      'round-recognition-types',
      'round-recognition-counts',
      'round-vacation-hours',
    ]);
  });

  it('reads the stored values: a missing one is the default, a switch 0 or 1', () => {
    const none = storedValues(() => undefined);
    expect(none).toEqual({
      ...RECOGNITION,
      abandonLock: 24,
      achievements: true,
      daily: true,
      guilds: true,
      mainLock: 7,
      ...activity,
      // 48 since 2026-11-18 (#223, D1).
      vacationHours: 48,
    });
    const stored: Record<string, number> = {
      roundAbandonLock: 48,
      roundAchievements: 0,
      roundDaily: 2,
      roundMainLock: 12,
      roundInactiveDays: 3,
      roundVacationHours: 72,
    };
    expect(storedValues((k) => stored[k])).toEqual({
      ...RECOGNITION,
      abandonLock: 48,
      achievements: false,
      daily: true,
      guilds: true,
      mainLock: 12,
      ...activity,
      inactiveDays: 3,
      vacationHours: 72,
    });
  });

  it('builds the request with a group as one object', () => {
    expect(roundRequest(current)).toEqual({
      recognition: RECOGNITION,
      abandonLock: 24,
      rewards: { achievements: true, daily: false },
      guilds: true,
      mainLock: 7,
      activity,
      vacationHours: 24,
    });
  });
});

describe('the check of a new round', () => {
  it('takes yes or no for every option', () => {
    for (const achievements of [true, false])
      for (const daily of [true, false])
        for (const guilds of [true, false]) {
          const data = { rewards: { achievements, daily }, guilds };
          expect(roundRefused(current, data)).toEqual([]);
          expect(roundValues(current, data)).toEqual({
            ...RECOGNITION,
            abandonLock: 24,
            achievements,
            daily,
            guilds,
            mainLock: 7,
            ...activity,
            vacationHours: 24,
          });
        }
  });

  it('keeps the current options that are not sent', () => {
    expect(roundRefused(current, {})).toEqual([]);
    expect(roundValues(current, {})).toEqual(current);
    expect(roundValues(current, { rewards: both })).toEqual({
      ...current,
      ...both,
    });
    expect(roundValues(current, { guilds: false, mainLock: 30 })).toEqual({
      ...current,
      guilds: false,
      mainLock: 30,
    });
  });

  it('refuses reward options that are not both yes or no', () => {
    for (const rewards of [
      null,
      {},
      { achievements: true },
      { daily: true },
      { achievements: 'true', daily: true },
      { achievements: true, daily: 1 },
      5,
      'yes',
    ])
      expect(code(rewards, true)).toBe('rewards');
  });

  it('refuses a guild switch that is not yes or no', () => {
    for (const guilds of ['false', 0, null, {}])
      expect(code(both, guilds)).toBe('guilds');
  });

  it('refuses a lock that is not a whole number of days from 1 to 30', () => {
    for (const mainLock of [0, 31, 2.5, '7', null, true])
      expect(refused(both, true, mainLock)).toEqual(['mainLock']);
    for (const mainLock of [1, 30, undefined])
      expect(refused(both, true, mainLock)).toEqual([]);
  });

  it('refuses a lock of a given-up position that is not a whole number of hours from 1 to 720 (#224)', () => {
    for (const abandonLock of [0, 721, 2.5, '24', null, true])
      expect(refused(both, true, 7, abandonLock)).toEqual(['abandonLock']);
    for (const abandonLock of [1, 720, undefined])
      expect(refused(both, true, 7, abandonLock)).toEqual([]);
  });

  it('refuses a minimum duration of the vacation mode that is not a whole number of hours from 1 to 720 (#223)', () => {
    for (const vacationHours of [0, 721, 2.5, '24', null, true])
      expect(refused(both, true, 7, 24, vacationHours)).toEqual([
        'vacationHours',
      ]);
    for (const vacationHours of [1, 720, undefined])
      expect(refused(both, true, 7, 24, vacationHours)).toEqual([]);
  });

  it('names the reward options first, then the guild switch, then the lock of the main planet, then the lock of a given-up position, then the minimum duration of the vacation mode', () => {
    expect(code({ achievements: true }, 'no')).toBe('rewards');
    expect(refused({}, 'no', 0, 0)).toEqual(['rewards', 'rewards']);
    expect(code(undefined, 'no')).toBe('guilds');
    expect(refused(undefined, 'no', 0, 0)).toEqual(['guilds']);
    expect(refused(undefined, undefined, 0, 0)).toEqual(['mainLock']);
    expect(refused(undefined, undefined, undefined, 0, 0)).toEqual([
      'abandonLock',
    ]);
    expect(refused(undefined, undefined, undefined, undefined, 0)).toEqual([
      'vacationHours',
    ]);
  });

  it('refuses the thresholds of the activity markers last and together (#229)', () => {
    const names = (data: Record<string, unknown>) =>
      roundRefused(current, data).map((s) => s.name);
    expect(names({ activity: { ...activity, activityMinutes: 0 } })).toEqual([
      'activityMinutes',
    ]);
    expect(names({ activity: {} })).toEqual([
      'activityRecent',
      'activityMinutes',
      'inactiveDays',
      'longInactiveDays',
    ]);
    expect(names({ abandonLock: 0, activity: {} })).toEqual(['abandonLock']);
    const custom = {
      activityRecent: 1,
      activityMinutes: 1440,
      inactiveDays: 365,
      longInactiveDays: 1,
    };
    expect(names({ activity: custom })).toEqual([]);
    expect(roundValues(current, { activity: custom })).toEqual({
      ...current,
      ...custom,
    });
  });

  it('refuses the wrong members of a group together, once per group', () => {
    expect(refused({}, 'no')).toEqual(['rewards', 'rewards']);
    expect(refused({ achievements: true }, true)).toEqual(['rewards']);
  });

  it('refuses exactly what is not yes or no (property)', () => {
    const value = fc.oneof(fc.boolean(), fc.constant(undefined), fc.anything());
    fc.assert(
      fc.property(value, value, value, (achievements, daily, guilds) => {
        const rewards = { achievements, daily };
        const error =
          typeof achievements !== 'boolean' || typeof daily !== 'boolean'
            ? 'rewards'
            : guilds === undefined || typeof guilds === 'boolean'
              ? null
              : 'guilds';
        expect(code(rewards, guilds)).toBe(error);
      }),
    );
  });
});
