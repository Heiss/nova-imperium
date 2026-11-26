// Points: 1 point per 1,000 resources in buildings, research, ships and
// defense. They are computed in one pass with the categories of the
// highscore (scores.ts, #405); this file keeps the exact total and the noob
// protection.
import { isProtected as protects } from '../../core/protection.ts';
import type { Ctx } from './context.ts';
import { scorePass } from './scores.ts';

export { topPoints } from './scores.ts';

/**
 * The exact points of every player now, a fresh pass: the archive of a round
 * and the tests. The state reads the stored pass (`storedScores`).
 */
export const pointsMap = (ctx: Ctx): Record<string, number> =>
  scorePass(ctx).total;

/** Noob protection: a player with less than a fifth of your points. */
export const isProtected = (
  me: string,
  target: string,
  pts: Record<string, number>,
): boolean => protects(pts[me] ?? 0, pts[target] ?? 0);
