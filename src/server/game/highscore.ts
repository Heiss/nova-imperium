// The categories of the highscore besides the total (#78): buildings and
// defense at 1 point per 1,000 resources (D5), fleet and research by count,
// 1 per ship and 1 per research level, as in classic (Q1, owiki
// „Statistik“). They are computed in one pass with the total (scores.ts,
// #405).
import type { Ctx } from './context.ts';
import { scorePass } from './scores.ts';

/** The categories of every player now, a fresh pass. */
export const categoryScores = (ctx: Ctx) => scorePass(ctx).categories;
