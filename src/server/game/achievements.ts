import {
  ACHIEVEMENTS,
  type AchievementState,
} from '../../core/achievements.ts';
import type { RoundRules } from '../../core/round.ts';
import {
  dailyReward,
  medianOutput,
  playerOutputs,
  roundDay,
} from '../../core/daily-reward.ts';
import { production } from '../../core/economy.ts';
import { settle, settleR } from '../../core/settle.ts';
import type { Cost, Levels, Planet } from '../../core/types.ts';
import type { User } from '../db/repos/players.ts';
import type { Action } from './actions.ts';
import { fail, universe, type Ctx } from './context.ts';

import { roundRules, roundStart } from './round.ts';
import type { ServerFeature } from './feature.ts';

const DAY = 86_400_000;
const dayOf = (ctx: Ctx): number => Math.floor(ctx.now() / DAY);

interface Daily {
  streak: number;
  claimed_day: number | null;
}

function recordDay(ctx: Ctx, uid: string, day: number): Daily {
  const db = ctx.db;
  db.prepare(
    `
    INSERT INTO daily_rewards (user_id, last_day, streak) VALUES (?, ?, 1)
    ON CONFLICT(user_id) DO UPDATE SET
      streak = CASE WHEN excluded.last_day = last_day + 1 THEN streak + 1 ELSE 1 END,
      last_day = excluded.last_day
    WHERE excluded.last_day > last_day
  `,
  ).run(uid, day);
  return db
    .prepare('SELECT streak, claimed_day FROM daily_rewards WHERE user_id = ?')
    .get(uid) as Daily;
}

function progressOf(ctx: Ctx, uid: string): Record<string, number> {
  const rows = ctx.db
    .prepare('SELECT metric, value FROM achievement_progress WHERE user_id = ?')
    .all(uid) as { metric: string; value: number }[];
  return Object.fromEntries(rows.map((r) => [r.metric, r.value]));
}

function recordProgress(
  ctx: Ctx,
  u: User,
  p: Planet | null,
): Record<string, number> {
  const progress = new Map(Object.entries(progressOf(ctx, u.id)));
  const put = ctx.db.prepare(`
    INSERT INTO achievement_progress VALUES (?, ?, ?)
    ON CONFLICT(user_id, metric) DO UPDATE SET value = max(value, excluded.value)
  `);
  const capture = (category: string, values: Levels): void => {
    for (const [key, value] of Object.entries(values)) {
      const metric = `${category}:${key}`;
      if (value <= (progress.get(metric) ?? 0)) continue;
      put.run(u.id, metric, value);
      progress.set(metric, value);
    }
  };
  capture('research', settleR(u, ctx.now()).research);
  if (p) {
    capture('buildings', p.b);
    capture('ships', p.ships);
    capture('defense', p.def);
  }
  return Object.fromEntries(progress);
}

function settledPlanet(ctx: Ctx, uid: string): Planet | null {
  const p = ctx.planets.home(uid);
  return p && settle(p, ctx.now(), universe(ctx));
}

/**
 * The median hourly production of all players (#220): per player the sum of
 * all their planets and moons as they produce now, then the median of each
 * resource over every account that owns a planet.
 */
function medianProduction(ctx: Ctx): Cost {
  const now = ctx.now();
  const u = universe(ctx);
  const owners = new Map(ctx.players.all().map((x) => [x.id, x]));
  const planets = ctx.planets.all().map((p) => {
    // Every planet has an owner (foreign key of the database).
    const owner = owners.get(p.owner)!;
    const research = settleR(owner, now).research;
    const { m, c, d } = production(settle(p, now, u, owner), u, research);
    return { owner: p.owner, m, c, d };
  });
  return medianOutput(playerOutputs(planets));
}

/** The day of the round and its reward now, and tomorrow's at the same production. */
function rewardNow(ctx: Ctx): { day: number; reward: Cost; next: Cost } {
  const day = roundDay(roundStart(ctx), ctx.now());
  const output = medianProduction(ctx);
  return {
    day,
    reward: dailyReward(output, day),
    next: dailyReward(output, day + 1),
  };
}

function dailyState(ctx: Ctx, uid: string): AchievementState['daily'] {
  const day = dayOf(ctx);
  const daily = recordDay(ctx, uid, day);
  return {
    streak: daily.streak,
    claimed: daily.claimed_day === day,
    ...rewardNow(ctx),
  };
}

export function achievementState(
  ctx: Ctx,
  u: User,
  rules: RoundRules = roundRules(ctx),
): AchievementState {
  return ctx.tx(() => {
    const progress = rules.achievements
      ? recordProgress(ctx, u, settledPlanet(ctx, u.id))
      : {};
    const rows = rules.achievements
      ? (ctx.db
          .prepare(
            'SELECT achievement_id FROM achievement_claims WHERE user_id = ?',
          )
          .all(u.id) as { achievement_id: string }[])
      : [];
    return {
      progress,
      claimed: rows.map((row) => row.achievement_id),
      daily: rules.daily ? dailyState(ctx, u.id) : null,
    };
  });
}

function credit(ctx: Ctx, p: Planet, reward: Cost): void {
  p.res.m += reward[0];
  p.res.c += reward[1];
  p.res.d += reward[2];
  ctx.planets.save(p);
}

const claimAchievement: Action = (ctx, u, data) => {
  if (!roundRules(ctx).achievements)
    fail('Achievements sind in dieser Runde deaktiviert.');
  const achievement =
    ACHIEVEMENTS.find((item) => item.id === data.id) ??
    fail('Unbekanntes Achievement.');
  const p = settledPlanet(ctx, u.id) ?? fail('Du brauchst einen Planeten.');
  const progress = recordProgress(ctx, u, p);
  if ((progress[achievement.metric] ?? 0) < achievement.target)
    fail('Dieses Achievement ist noch offen.');
  const insert = ctx.db
    .prepare('INSERT OR IGNORE INTO achievement_claims VALUES (?, ?)')
    .run(u.id, achievement.id);
  if (!insert.changes) fail('Diese Belohnung wurde schon abgeholt.');
  credit(ctx, p, achievement.reward);
  return 'Achievement-Belohnung abgeholt.';
};

export const claimDailyReward: Action = (live, u) => {
  // One timestamp for the claimed day and the reward, so a claim at UTC
  // midnight does not record one day and credit the next one's reward.
  const at = live.now();
  const ctx: Ctx = { ...live, now: () => at };
  if (!roundRules(ctx).daily)
    fail('Tagesbelohnungen sind in dieser Runde deaktiviert.');
  const p = settledPlanet(ctx, u.id) ?? fail('Du brauchst einen Planeten.');
  const day = dayOf(ctx);
  recordDay(ctx, u.id, day);
  const update = ctx.db
    .prepare(
      `
    UPDATE daily_rewards SET claimed_day = ?
    WHERE user_id = ? AND last_day = ? AND (claimed_day IS NULL OR claimed_day < ?)
  `,
    )
    .run(day, u.id, day, day);
  if (!update.changes) fail('Die heutige Belohnung wurde schon abgeholt.');
  // The streak no longer changes the reward (#220 D3).
  credit(ctx, p, rewardNow(ctx).reward);
  return 'Tägliche Belohnung abgeholt.';
};

export function recordAchievementAction(
  ctx: Ctx,
  uid: string,
  action: string,
): void {
  const metric =
    action === 'send' ? 'fleet:send' : action === 'order' ? 'yard:order' : null;
  if (!metric || !roundRules(ctx).achievements) return;
  ctx.db
    .prepare(
      `
    INSERT INTO achievement_progress VALUES (?, ?, 1)
    ON CONFLICT(user_id, metric) DO UPDATE SET value = value + 1
  `,
    )
    .run(uid, metric);
}

export const serverFeature = {
  actions: { claimAchievement, claimDailyReward },
  state: {
    order: 130,
    keys: ['achievements'],
    build: (ctx, u, view) => ({
      achievements: achievementState(ctx, u, view.round),
    }),
  },
} satisfies ServerFeature;
