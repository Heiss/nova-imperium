// The public activity markers on the server (#229, owner, 2026-11-16 and
// 2026-11-17): a login marks the main planet, a manual action every own
// planet and moon, both the account; the state shows only the markers; the
// thresholds are round values, set in „Neue Runde“ and live in the
// universe settings (X1).
import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_DEFAULT,
  DAY_MS,
  MINUTE_MS,
  activityLimits,
} from '../../core/activity.ts';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import {
  inactivities,
  placeActivity,
  planetActivities,
  recordActivity,
} from './activity.ts';
import { runAction } from './dispatch.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

const START = Date.UTC(2026, 10, 17, 12, 0);

/** Anna (admin) with her first planet, a colony as main planet and a moon; Bert with his first planet. */
function world(): TestCtx {
  const ctx = testCtx(START);
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, name: 'Heim' });
  ctx.clock.t += 1;
  addPlanet(ctx, 'u_Anna', { g: 2, s: 3, p: 7, name: 'Kolonie' });
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, kind: 'moon', id: 'm1_1_5' });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 2, p: 5, name: 'Bertheim' });
  return ctx;
}

const user = (ctx: TestCtx, uid: string) => ctx.players.get(uid)!;

type Shown = {
  players: Record<string, Record<string, unknown>>;
  galaxy: Record<string, unknown>[];
};
const shown = (ctx: TestCtx) =>
  stateFor(ctx, user(ctx, 'u_Bert')) as unknown as Shown;
const galaxyOf = (ctx: TestCtx, id: string) =>
  shown(ctx).galaxy.find((p) => p.id === id)!;

describe('what sets activity', () => {
  it('a login: only the main planet, and the account', () => {
    const ctx = world();
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: 'p2_3_7' });
    ctx.clock.t += 5;
    recordActivity(ctx, user(ctx, 'u_Anna'), 'login');
    expect(ctx.planets.activeTimes()).toEqual({ p2_3_7: ctx.now() });
    expect(ctx.players.lastActive().u_Anna).toBe(ctx.now());
    // Bert's account and planet stay as they were.
    expect(ctx.players.lastActive().u_Bert).toBe(START);
  });

  it('a login without a chosen main planet: the first planet', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'login');
    expect(ctx.planets.activeTimes()).toEqual({ p1_1_5: ctx.now() });
  });

  it('a login of a player without a planet: only the account', () => {
    const ctx = world();
    addUser(ctx, 'Cara');
    ctx.clock.t += 9;
    recordActivity(ctx, user(ctx, 'u_Cara'), 'login');
    expect(ctx.planets.activeTimes()).toEqual({});
    expect(ctx.players.lastActive().u_Cara).toBe(ctx.now());
  });

  it('a manual action: every own planet and moon, and the account', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    const t = ctx.now();
    expect(ctx.planets.activeTimes()).toEqual({
      p1_1_5: t,
      p2_3_7: t,
      m1_1_5: t,
    });
    expect(ctx.players.lastActive().u_Anna).toBe(t);
  });

  it('an account in vacation mode records none, a login or an action (#223)', () => {
    const ctx = world();
    const anna = { ...user(ctx, 'u_Anna'), vacation: ctx.now() };
    ctx.clock.t += 5 * MINUTE_MS;
    recordActivity(ctx, anna, 'login');
    recordActivity(ctx, anna, 'action');
    expect(ctx.planets.activeTimes()).toEqual({});
    expect(ctx.players.lastActive().u_Anna).toBe(START);
    recordActivity(ctx, { ...anna, vacation: null }, 'action');
    expect(ctx.players.lastActive().u_Anna).toBe(ctx.now());
  });

  it('a game action itself sets nothing, so fleets and buildings set none', () => {
    const ctx = world();
    runAction(ctx, 'u_Anna', { type: 'mainPlanet', main: 'p2_3_7' });
    expect(ctx.planets.activeTimes()).toEqual({});
    expect(ctx.players.lastActive()).toEqual({
      u_Anna: START,
      u_Bert: START,
    });
  });
});

describe('what the state shows', () => {
  it('the activity of a planet and a moon, never the time', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    expect(galaxyOf(ctx, 'p1_1_5').activity).toEqual({ recent: true });
    expect(galaxyOf(ctx, 'm1_1_5').activity).toEqual({ recent: true });
    expect(galaxyOf(ctx, 'p1_2_5')).not.toHaveProperty('activity');
    ctx.clock.t += 15 * MINUTE_MS;
    expect(galaxyOf(ctx, 'p2_3_7').activity).toEqual({ minutes: 15 });
    ctx.clock.t += 44 * MINUTE_MS + 59_999;
    expect(galaxyOf(ctx, 'p2_3_7').activity).toEqual({ minutes: 59 });
    ctx.clock.t += 1;
    expect(galaxyOf(ctx, 'p2_3_7')).not.toHaveProperty('activity');
    expect(JSON.stringify(shown(ctx))).not.toContain('active_at');
  });

  it('the inactivity of an account after 7 and 28 days, counted from its creation without activity', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    const players = () => shown(ctx).players;
    expect(players().u_Bert).toEqual({
      name: 'Bert',
      points: 0,
      scores: { buildings: 0, research: 0, fleet: 0, defense: 0 },
    });
    // Bert was created at the start.
    ctx.clock.t = START + 7 * DAY_MS - 1;
    expect(players().u_Bert).not.toHaveProperty('inactive');
    ctx.clock.t += 1;
    expect(players().u_Bert!.inactive).toBe('inactive');
    expect(players().u_Anna).not.toHaveProperty('inactive');
    ctx.clock.t += 21 * DAY_MS;
    expect(players().u_Bert!.inactive).toBe('long');
    expect(players().u_Anna!.inactive).toBe('inactive');
    // Planet activity is gone long before.
    expect(shown(ctx).galaxy.filter((p) => 'activity' in p)).toEqual([]);
  });

  it('the markers follow the thresholds given', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    ctx.clock.t += 3 * DAY_MS;
    const limits = { ...ACTIVITY_DEFAULT, minutes: 5000, inactive: 2 };
    expect(planetActivities(ctx, limits)).toEqual({
      p1_1_5: { minutes: 4320 },
      p2_3_7: { minutes: 4320 },
      m1_1_5: { minutes: 4320 },
    });
    expect(inactivities(ctx, limits)).toEqual({
      u_Anna: 'inactive',
      u_Bert: 'inactive',
    });
    expect(planetActivities(ctx, ACTIVITY_DEFAULT)).toEqual({});
    expect(inactivities(ctx, ACTIVITY_DEFAULT)).toEqual({});
  });
});

describe('the activity of one place (#175, D5)', () => {
  it('follows the rule and the thresholds of the Sternenkarte, with none without a time', () => {
    const ctx = world();
    const limits = activityLimits(roundRules(ctx));
    expect(ctx.planets.activeAt('p1_1_5')).toBeNull();
    expect(ctx.planets.activeAt('nowhere')).toBeNull();
    expect(placeActivity(ctx, 'p1_1_5', START, limits)).toBeNull();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    const t = ctx.now();
    expect(ctx.planets.activeAt('p1_1_5')).toBe(t);
    expect(ctx.planets.activeAt('p1_2_5')).toBeNull();
    expect(placeActivity(ctx, 'p1_1_5', t + 14 * MINUTE_MS, limits)).toEqual({
      recent: true,
    });
    expect(placeActivity(ctx, 'm1_1_5', t + 20 * MINUTE_MS, limits)).toEqual({
      minutes: 20,
    });
    expect(placeActivity(ctx, 'p1_1_5', t + 60 * MINUTE_MS, limits)).toBeNull();
    expect(placeActivity(ctx, 'p1_2_5', t, limits)).toBeNull();
  });
});

describe('the thresholds per round (Q1, X1)', () => {
  const CLASSIC = {
    activityRecent: 15,
    activityMinutes: 59,
    inactiveDays: 7,
    longInactiveDays: 28,
  };
  const custom = {
    activityRecent: 10,
    activityMinutes: 30,
    inactiveDays: 3,
    longInactiveDays: 14,
  };

  it('are the classic values in an existing universe', () => {
    expect(roundRules(world())).toMatchObject(CLASSIC);
    expect(activityLimits(roundRules(world()))).toEqual(ACTIVITY_DEFAULT);
  });

  it('are set in „Neue Runde“, kept without a choice and in the audit entry', () => {
    const ctx = world();
    const event = {} as AuditEntry;
    runAction(ctx, 'u_Anna', { type: 'reset', activity: custom }, event);
    expect(roundRules(ctx)).toMatchObject(custom);
    expect(ctx.admin.setting('roundActivityRecent')).toBe(10);
    expect(ctx.admin.setting('roundActivityMinutes')).toBe(30);
    expect(ctx.admin.setting('roundInactiveDays')).toBe(3);
    expect(ctx.admin.setting('roundLongInactiveDays')).toBe(14);
    expect(event.detail).toMatchObject({ before: CLASSIC, after: custom });
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(roundRules(ctx)).toMatchObject({ number: 3, ...custom });
  });

  it('refuse every wrong value at once, as the universe settings word it', () => {
    const ctx = world();
    expect(() =>
      runAction(ctx, 'u_Anna', {
        type: 'reset',
        activity: {
          activityRecent: 0,
          activityMinutes: 30,
          inactiveDays: null,
          longInactiveDays: 1.5,
        },
      }),
    ).toThrow(
      'Aktivität ohne Minutenangabe (Minuten): ganze Zahl von 1 bis 60. Inaktiv ab (Tage): ganze Zahl von 1 bis 365. Lange inaktiv ab (Tage): ganze Zahl von 1 bis 365.',
    );
    expect(roundRules(ctx)).toMatchObject({ number: 1, ...CLASSIC });
  });

  it('are changed live in the universe settings and shown at once', () => {
    const ctx = world();
    recordActivity(ctx, user(ctx, 'u_Anna'), 'action');
    ctx.clock.t += 20 * MINUTE_MS;
    expect(galaxyOf(ctx, 'p1_1_5').activity).toEqual({ minutes: 20 });
    expect(
      runAction(ctx, 'u_Anna', {
        type: 'settings',
        settings: { ...DEFAULT_UNIVERSE, roundActivityRecent: 30 },
      }),
    ).toBe('Einstellungen gespeichert.');
    expect(roundRules(ctx)).toMatchObject({ ...CLASSIC, activityRecent: 30 });
    expect(galaxyOf(ctx, 'p1_1_5').activity).toEqual({ recent: true });
    // The new round offers the value of the settings.
    runAction(ctx, 'u_Anna', { type: 'reset' });
    expect(roundRules(ctx).activityRecent).toBe(30);
  });
});
