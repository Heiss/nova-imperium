// The checks of the rewards (#214, patterns, section 7): `claimAchievement`
// and `claimDailyReward` ask these pure functions, which return the code of
// the first refusal in the order the server has always checked, or null; the
// server words the codes (`CLAIM_ERROR`, `DAILY_ERROR` in
// server/game/achievements.ts). The page „Achievements“ sorts its entries
// with `achievementStatus` (client/logic/achievements.ts). That a reward is
// taken only once, an achievement once and the daily reward once a day,
// stays a guard in SQL on the server, in the transaction of the claim.
import { ACHIEVEMENTS, type Achievement } from './achievements.ts';

/** Where an achievement stands for a player: taken, ready to take, or open. */
export type AchievementStatus = 'claimed' | 'ready' | 'open';

/** Whether the recorded progress reaches the target of the achievement. */
export const reached = (
  item: Achievement,
  progress: Readonly<Record<string, number>>,
): boolean => (progress[item.metric] ?? 0) >= item.target;

/** The status of an achievement by the claimed ids and the progress. */
export const achievementStatus = (
  item: Achievement,
  progress: Readonly<Record<string, number>>,
  claimed: ReadonlySet<string>,
): AchievementStatus => {
  if (claimed.has(item.id)) return 'claimed';
  return reached(item, progress) ? 'ready' : 'open';
};

/** The achievement of an id as sent, exactly; undefined for any other value. */
export const achievementOf = (id: unknown): Achievement | undefined =>
  ACHIEVEMENTS.find((item) => item.id === id);

/** Why an achievement cannot be claimed: off in the round, unknown, no planet, not reached. */
export type ClaimError = 'off' | 'unknown' | 'planet' | 'open';

/**
 * `claimAchievement`: achievements in the round, a known achievement, a home
 * planet, then the progress at its target.
 */
export function claimError(
  on: boolean,
  item: Achievement | undefined,
  planet: boolean,
  progress: Readonly<Record<string, number>>,
): ClaimError | null {
  if (!on) return 'off';
  if (!item) return 'unknown';
  if (!planet) return 'planet';
  return reached(item, progress) ? null : 'open';
}

/** Why the daily reward cannot be claimed: off in the round, or no planet. */
export type DailyError = 'off' | 'planet';

/** `claimDailyReward`: daily rewards in the round, then a home planet. */
export const dailyError = (on: boolean, planet: boolean): DailyError | null =>
  !on ? 'off' : planet ? null : 'planet';
