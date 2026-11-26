// The categories of the highscore besides the total (#422): Wirtschaft and
// Militär, each by number and by the resources spent / 1,000; the state
// shows the mode the round sets. They are computed in one pass with the
// total (scores.ts, #405).
import type { Ctx } from './context.ts';
import { scorePass } from './scores.ts';

/** The categories of every player now, a fresh pass. */
export const categoryScores = (ctx: Ctx) => scorePass(ctx).categories;
