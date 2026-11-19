// The routes of the estimated active play time (#232, #231): the reports of
// the browser, and the player's own statistics. Both take the account from
// the session; no request names another player.
import type { User } from '../db/repos/players.ts';
import { ownActivity, recordPlaytime } from '../game/playtime.ts';
import type { AppDeps, Call, Handler } from './app.ts';

export function playtimeRoutes(
  d: AppDeps,
  sessionUser: (call: Call) => User,
): Record<string, Handler> {
  const { ctx } = d;
  return {
    // A report of a page. It is no manual action: it sets no public
    // activity (#229), the heartbeat of an idle page never does.
    'POST /api/playtime': (call) => {
      recordPlaytime(ctx, sessionUser(call), call.body);
      return { json: { ok: true } };
    },
    'GET /api/own-activity': (call) => ({
      json: ownActivity(ctx, sessionUser(call)),
    }),
  };
}
