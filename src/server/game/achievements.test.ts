import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, dailyReward } from '../../shared/achievements.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { achievementState, recordAchievementAction } from './achievements.ts';
import { roundRules } from './round.ts';
import { runAction } from './dispatch.ts';

const DAY = 86_400_000;

describe('achievements', () => {
  it('defines a large, unique catalog and applies a modest reward once', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThan(250);
    expect(new Set(ACHIEVEMENTS.map((item) => item.id)).size).toBe(
      ACHIEVEMENTS.length,
    );
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    const p = addPlanet(ctx, u.id, { b: { metal: 1 } });
    const id = 'buildings:metal:1';
    expect(() =>
      runAction(ctx, u.id, { type: 'claimAchievement', id: 'unknown' }),
    ).toThrow('Unbekanntes');
    expect(() =>
      runAction(ctx, u.id, {
        type: 'claimAchievement',
        id: 'buildings:metal:2',
      }),
    ).toThrow('noch offen');
    const reward = ACHIEVEMENTS.find((item) => item.id === id)!.reward;
    expect(reward[0]).toBeGreaterThan(0);
    expect(reward[0]).toBeLessThan(10);
    runAction(ctx, u.id, { type: 'claimAchievement', id });
    expect(() =>
      runAction(ctx, u.id, { type: 'claimAchievement', id }),
    ).toThrow('schon abgeholt');
    expect(ctx.store.planet(p.id)?.res.m).toBe(p.res.m + reward[0]);
    expect(achievementState(ctx, u).claimed).toEqual([id]);
  });

  it('keeps recorded progress and counts successful tracked actions', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    const p = addPlanet(ctx, u.id, { ships: { sc: 5 } });
    expect(achievementState(ctx, u).progress['ships:sc']).toBe(5);
    ctx.store.savePlanet({ ...p, ships: {} });
    recordAchievementAction(ctx, u.id, 'send');
    recordAchievementAction(ctx, u.id, 'order');
    recordAchievementAction(ctx, u.id, 'order');
    expect(achievementState(ctx, u).progress).toMatchObject({
      'ships:sc': 5,
      'fleet:send': 1,
      'yard:order': 2,
    });
  });

  it('starts a fresh reward history and enforces each round option independently', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna', { admin: true });
    const p = addPlanet(ctx, u.id, { b: { metal: 1 } });
    const id = 'buildings:metal:1';
    runAction(ctx, u.id, { type: 'claimAchievement', id });
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    expect(() =>
      runAction(ctx, u.id, {
        type: 'reset',
        rewards: { achievements: false },
      }),
    ).toThrow('beide Belohnungseinstellungen');
    expect(ctx.store.planet(p.id)?.b.metal).toBe(1);
    runAction(ctx, u.id, {
      type: 'reset',
      rewards: { achievements: false, daily: true },
    });
    expect(roundRules(ctx)).toEqual({
      number: 2,
      achievements: false,
      daily: true,
    });
    recordAchievementAction(ctx, u.id, 'send');
    const current = ctx.store.user(u.id)!;
    expect(achievementState(ctx, current)).toMatchObject({
      progress: {},
      claimed: [],
      daily: { claimed: false, streak: 1 },
    });
    expect(
      ctx.store.db.prepare('SELECT * FROM achievement_progress').all(),
    ).toEqual([]);
    expect(() =>
      runAction(ctx, u.id, { type: 'claimAchievement', id }),
    ).toThrow('deaktiviert');
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    runAction(ctx, u.id, {
      type: 'reset',
      rewards: { achievements: true, daily: false },
    });
    expect(achievementState(ctx, ctx.store.user(u.id)!)).toEqual({
      progress: {},
      claimed: [],
      daily: null,
    });
    expect(ctx.store.db.prepare('SELECT * FROM daily_rewards').all()).toEqual(
      [],
    );
    expect(() => runAction(ctx, u.id, { type: 'claimDailyReward' })).toThrow(
      'deaktiviert',
    );
  });

  it('shows the next reward, limits claims to once per UTC day, and resets a missed streak', () => {
    const ctx = testCtx(DAY - 1);
    const u = addUser(ctx, 'Anna');
    addPlanet(ctx, u.id);
    expect(achievementState(ctx, u).daily).toEqual({
      streak: 1,
      claimed: false,
      reward: dailyReward(1),
      next: dailyReward(2),
    });
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    expect(() => runAction(ctx, u.id, { type: 'claimDailyReward' })).toThrow(
      'schon abgeholt',
    );
    expect(achievementState(ctx, u).daily).toMatchObject({
      claimed: true,
      next: dailyReward(2),
    });
    ctx.clock.t += 1;
    expect(achievementState(ctx, u).daily).toMatchObject({
      streak: 2,
      claimed: false,
      reward: dailyReward(2),
    });
    ctx.clock.t += DAY * 2;
    expect(achievementState(ctx, u).daily?.streak).toBe(1);
    expect(dailyReward(20)).toEqual(dailyReward(7));
  });
});
