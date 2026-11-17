import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../core/achievements.ts';
import { dailyReward } from '../../core/daily-reward.ts';
import { production } from '../../core/economy.ts';
import { settle } from '../../core/settle.ts';
import type { Cost, Planet } from '../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import {
  achievementState,
  claimDailyReward,
  recordAchievementAction,
} from './achievements.ts';
import { universe, type Ctx } from './context.ts';
import { roundRules, roundStart } from './round.ts';
import { runAction } from './dispatch.ts';

const DAY = 86_400_000;

/** A planet as it is now. */
const settled = (ctx: Ctx, p: Planet): Planet =>
  settle(p, ctx.now(), universe(ctx));

/** The hourly production of the given planets of one player, added up. */
function hourly(ctx: Ctx, planets: Planet[]): Cost {
  let [m, c, d] = [0, 0, 0];
  for (const p of planets) {
    const pr = production(settled(ctx, p), universe(ctx));
    m += pr.m;
    c += pr.c;
    d += pr.d;
  }
  return [m, c, d];
}

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
    expect(ctx.planets.get(p.id)?.res.m).toBe(p.res.m + reward[0]);
    expect(achievementState(ctx, u).claimed).toEqual([id]);
  });

  it('keeps recorded progress and counts successful tracked actions', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    const p = addPlanet(ctx, u.id, { ships: { sc: 5 } });
    expect(achievementState(ctx, u).progress['ships:sc']).toBe(5);
    ctx.planets.save({ ...p, ships: {} });
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
    expect(ctx.planets.get(p.id)?.b.metal).toBe(1);
    runAction(ctx, u.id, {
      type: 'reset',
      rewards: { achievements: false, daily: true },
    });
    expect(roundRules(ctx)).toEqual({
      number: 2,
      achievements: false,
      daily: true,
      // Without a guild choice the round keeps guilds on (#191).
      guilds: true,
      // Without a choice the round keeps the lock of the main planet (#221).
      mainLock: 7,
      demolition: { refund: 50, time: 50 },
    });
    recordAchievementAction(ctx, u.id, 'send');
    const current = ctx.players.get(u.id)!;
    expect(achievementState(ctx, current)).toMatchObject({
      progress: {},
      claimed: [],
      daily: { claimed: false, streak: 1 },
    });
    expect(ctx.db.prepare('SELECT * FROM achievement_progress').all()).toEqual(
      [],
    );
    expect(() =>
      runAction(ctx, u.id, { type: 'claimAchievement', id }),
    ).toThrow('deaktiviert');
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    runAction(ctx, u.id, {
      type: 'reset',
      rewards: { achievements: true, daily: false },
    });
    expect(achievementState(ctx, ctx.players.get(u.id)!)).toEqual({
      progress: {},
      claimed: [],
      daily: null,
    });
    expect(ctx.db.prepare('SELECT * FROM daily_rewards').all()).toEqual([]);
    expect(() => runAction(ctx, u.id, { type: 'claimDailyReward' })).toThrow(
      'deaktiviert',
    );
  });

  it('limits claims to once per UTC day and resets a missed streak, not the reward', () => {
    const ctx = testCtx(DAY - 1);
    ctx.admin.putSettings([['roundStart', 0]]);
    const u = addUser(ctx, 'Anna');
    const p = addPlanet(ctx, u.id, { b: { metal: 5, crystal: 3, solar: 8 } });
    const output = hourly(ctx, [p]);
    expect(achievementState(ctx, u).daily).toEqual({
      streak: 1,
      claimed: false,
      day: 1,
      reward: dailyReward(output, 1),
      next: dailyReward(output, 2),
    });
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    expect(() => runAction(ctx, u.id, { type: 'claimDailyReward' })).toThrow(
      'schon abgeholt',
    );
    expect(achievementState(ctx, u).daily).toMatchObject({
      claimed: true,
      day: 1,
      next: dailyReward(output, 2),
    });
    ctx.clock.t += 1;
    expect(achievementState(ctx, u).daily).toMatchObject({
      streak: 2,
      claimed: false,
      day: 2,
      reward: dailyReward(output, 2),
    });
    // Two days later the shown streak starts at 1 again; the reward is that
    // of day 4 of the round, not of day 1 (#220 D3).
    ctx.clock.t += DAY * 2;
    const reward = dailyReward(output, 4);
    expect(reward[0]).toBeGreaterThan(dailyReward(output, 1)[0]);
    expect(achievementState(ctx, u).daily).toMatchObject({
      streak: 1,
      claimed: false,
      day: 4,
      reward,
    });
    const before = settled(ctx, ctx.planets.get(p.id)!).res;
    runAction(ctx, u.id, { type: 'claimDailyReward' });
    const after = ctx.planets.get(p.id)!.res;
    expect(after.m - before.m).toBeCloseTo(reward[0], 6);
    expect(after.c - before.c).toBeCloseTo(reward[1], 6);
  });
  it('reads the clock once per daily claim, so day and reward stay one day', () => {
    const ctx = testCtx(DAY - 1);
    ctx.admin.putSettings([['roundStart', 0]]);
    const u = addUser(ctx, 'Anna');
    const p = addPlanet(ctx, u.id, { b: { metal: 5, crystal: 3, solar: 8 } });
    const output = hourly(ctx, [p]);
    // The first read is just before UTC midnight, every later one after it.
    let reads = 0;
    const late: Ctx = {
      ...ctx,
      now: () => (reads++ === 0 ? DAY - 1 : DAY),
    };
    const before = settled(ctx, ctx.planets.get(p.id)!).res;
    ctx.tx(() => claimDailyReward(late, u, {}));
    expect(reads).toBe(1);
    const { claimed_day } = ctx.db
      .prepare('SELECT claimed_day FROM daily_rewards WHERE user_id = ?')
      .get(u.id) as { claimed_day: number };
    expect(claimed_day).toBe(0);
    const after = ctx.planets.get(p.id)!.res;
    expect(after.m - before.m).toBeCloseTo(dailyReward(output, 1)[0], 6);
  });
});

describe('daily reward scaled by the production of all players (#220)', () => {
  /**
   * Day 5 of the round. Anna: a home planet and a colony, Bert: one planet,
   * Cora: the strongest mines, Dora: no planet (she takes no part in the
   * median).
   */
  function universeOfFour() {
    const ctx = testCtx(Date.UTC(2026, 10, 20, 12));
    ctx.admin.putSettings([['roundStart', Date.UTC(2026, 10, 16, 21, 37)]]);
    const anna = addUser(ctx, 'Anna');
    const bert = addUser(ctx, 'Bert');
    const cora = addUser(ctx, 'Cora');
    const dora = addUser(ctx, 'Dora');
    const home = addPlanet(ctx, anna.id, {
      b: { metal: 4, crystal: 2, solar: 6 },
    });
    const colony = addPlanet(ctx, anna.id, {
      p: 6,
      b: { metal: 3, deut: 2, solar: 5 },
    });
    const bertP = addPlanet(ctx, bert.id, {
      p: 7,
      b: { metal: 8, crystal: 1, deut: 1, solar: 10 },
    });
    const coraP = addPlanet(ctx, cora.id, {
      p: 8,
      b: { metal: 15, crystal: 12, deut: 10, solar: 20 },
    });
    return { ctx, anna, bert, cora, dora, home, colony, bertP, coraP };
  }

  it('gives every player the median hourly production times the minutes of the day of the round', () => {
    const w = universeOfFour();
    const anna = hourly(w.ctx, [w.home, w.colony]);
    const bert = hourly(w.ctx, [w.bertP]);
    const cora = hourly(w.ctx, [w.coraP]);
    // Each resource has its own middle player.
    const middle = (i: 0 | 1 | 2): number =>
      [anna[i], bert[i], cora[i]].sort((a, b) => a - b)[1]!;
    const output: Cost = [middle(0), middle(1), middle(2)];
    expect(output.every((v) => v > 0)).toBe(true);
    // 2026-11-20 is day 5 of a round started on 2026-11-16: 58 minutes.
    const reward = dailyReward(output, 5);
    expect(reward).toEqual(output.map((v) => Math.floor((v * 58) / 60)));
    for (const user of [w.anna, w.bert, w.cora, w.dora])
      expect(achievementState(w.ctx, user).daily).toMatchObject({
        day: 5,
        reward,
        next: dailyReward(output, 6),
      });
  });

  it('credits the shown reward on the home planet, above the storage', () => {
    const w = universeOfFour();
    const full = { m: 9e9, c: 9e9, d: 9e9 };
    w.ctx.planets.save({ ...w.bertP, res: full });
    const shown = achievementState(w.ctx, w.bert).daily!.reward;
    expect(shown.every((v) => v > 0)).toBe(true);
    runAction(w.ctx, w.bert.id, { type: 'claimDailyReward' });
    const after = w.ctx.planets.get(w.bertP.id)!.res;
    expect(after).toEqual({
      m: full.m + shown[0],
      c: full.c + shown[1],
      d: full.d + shown[2],
    });
    expect(w.ctx.planets.get(w.coraP.id)!.res).toEqual(w.coraP.res);
  });

  it('follows the production of all players at the time of the claim', () => {
    const w = universeOfFour();
    const shown = achievementState(w.ctx, w.anna).daily!.reward;
    // Bert's mines grow past Anna's: the median player changes.
    w.ctx.planets.save({
      ...w.bertP,
      b: { metal: 14, crystal: 11, deut: 9, solar: 19 },
    });
    const now = achievementState(w.ctx, w.anna).daily!.reward;
    expect(now[0]).toBeGreaterThan(shown[0]);
    const before = settled(w.ctx, w.ctx.planets.get(w.home.id)!).res;
    runAction(w.ctx, w.anna.id, { type: 'claimDailyReward' });
    const after = w.ctx.planets.get(w.home.id)!.res;
    expect(after.m - before.m).toBeCloseTo(now[0], 6);
    expect(w.ctx.planets.get(w.colony.id)!.res).toEqual(w.colony.res);
  });

  it('starts at day 1 again with a new round', () => {
    const w = universeOfFour();
    const admin = addUser(w.ctx, 'Admin', { admin: true });
    w.ctx.clock.t += 40 * DAY;
    expect(achievementState(w.ctx, w.anna).daily?.day).toBe(45);
    runAction(w.ctx, admin.id, { type: 'reset' });
    expect(w.ctx.admin.setting('roundStart')).toBe(w.ctx.now());
    const anna = w.ctx.players.get(w.anna.id)!;
    expect(achievementState(w.ctx, anna).daily?.day).toBe(1);
    w.ctx.clock.t += DAY;
    expect(achievementState(w.ctx, anna).daily?.day).toBe(2);
  });

  it('counts a round without a stored start from now', () => {
    const w = universeOfFour();
    w.ctx.db.prepare("DELETE FROM settings WHERE key = 'roundStart'").run();
    expect(roundStart(w.ctx)).toBe(w.ctx.now());
    expect(achievementState(w.ctx, w.anna).daily?.day).toBe(1);
  });

  it('gives nothing while no player has a planet', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Anna');
    expect(achievementState(ctx, u).daily?.reward).toEqual([0, 0, 0]);
    expect(() => runAction(ctx, u.id, { type: 'claimDailyReward' })).toThrow(
      'Du brauchst einen Planeten.',
    );
  });
});
