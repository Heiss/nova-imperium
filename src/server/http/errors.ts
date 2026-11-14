// What signed-in browsers send about problems (issue #126): their errors and
// the problem reports of their players, each with a limit per player.
import {
  CLIENT_ERRORS_PER_DAY,
  CLIENT_ERRORS_PER_MINUTE,
  REPORTS_PER_HOUR,
} from '../../core/error-log.ts';
import { DAY } from '../audit.ts';
import type { User } from '../db/repos/players.ts';
import { readReport, recordClientError, recordReport } from '../error-log.ts';
import { fail } from '../game/context.ts';
import type { AppDeps, Call, Handler } from './app.ts';
import { RateLimiter } from './rate-limit.ts';

const REPORT_THANKS = 'Danke, die Meldung ist angekommen.';

export function errorRoutes(
  d: AppDeps,
  sessionUser: (call: Call) => User,
): { routes: Record<string, Handler>; sweep: () => void } {
  const { ctx } = d;
  const minute = new RateLimiter(CLIENT_ERRORS_PER_MINUTE, 60000, ctx.now);
  const day = new RateLimiter(CLIENT_ERRORS_PER_DAY, DAY, ctx.now);
  const hour = new RateLimiter(REPORTS_PER_HOUR, 3600000, ctx.now);
  const version = d.news?.version ?? '';
  const routes: Record<string, Handler> = {
    'POST /api/errors': (call) => {
      const u = sessionUser(call);
      // A day is only counted while the minute has room.
      if (minute.limited(u.id) || day.limited(u.id))
        return { status: 429, json: { error: 'Zu viele Fehlermeldungen.' } };
      recordClientError(ctx, u, call.body, version);
      return { json: { ok: true } };
    },
    'POST /api/report': (call) => {
      const u = sessionUser(call);
      const report = readReport(call.body, version);
      if (hour.limited(u.id))
        fail('Zu viele Meldungen – bitte in einer Stunde nochmal.');
      recordReport(ctx, u, report);
      return { json: { ok: true, msg: REPORT_THANKS } };
    },
  };
  const sweep = (): void => {
    minute.sweep();
    day.sweep();
    hour.sweep();
  };
  return { routes, sweep };
}
