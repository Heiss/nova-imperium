// The estimated active play time on the server (#232, #231,
// okf/features/own-activity.md): the reports of the browser become accepted
// intervals, and every total is derived from the intervals on read. A
// player reads only their own; the admin diagnostics use the same sums.
import { DAY_MS } from '../../core/activity.ts';
import {
  METHOD_VERSION,
  activeMs,
  dailyMs,
  type DayRow,
  type Interval,
  type OwnActivity,
  judge,
  readReport,
  sessionOf,
  utcDay,
} from '../../core/playtime.ts';
import type { User } from '../db/repos/players.ts';
import { type Ctx, fail } from './context.ts';

/** The days the view and the admin show: today and the six before, in UTC. */
const DAYS_SHOWN = 7;
const FOREVER = Number.MAX_SAFE_INTEGER;

/** The start of the oldest day shown. */
const weekStart = (now: number): number =>
  utcDay(now) - (DAYS_SHOWN - 1) * DAY_MS;

/** The number of the running round; a database without one is in round 1. */
const roundOf = (ctx: Ctx): number => ctx.admin.setting('round') ?? 1;

/**
 * Takes a report of a page of `u`. An account in vacation mode records none
 * (#223); a report that is no report is refused, any other is accepted or
 * ignored by `judge`, so a retry is not an error.
 */
export function recordPlaytime(
  ctx: Ctx,
  u: User,
  body: Record<string, unknown>,
): void {
  const report = readReport(body);
  if (!report) fail('Ungültige Meldung.');
  if (u.vacation !== null) return;
  const now = ctx.now();
  ctx.tx(() => {
    const verdict = judge(
      report!,
      ctx.playtime.lastOfInstance(u.id, report!.instance),
      now,
    );
    if (!verdict.accept) return;
    const round = roundOf(ctx);
    ctx.playtime.append({
      user: u.id,
      round,
      session: sessionOf(ctx.playtime.lastOfPlayer(u.id), verdict.start, round),
      instance: report!.instance,
      seq: report!.seq,
      state: report!.state,
      reason: verdict.reason,
      start: verdict.start,
      end: verdict.end,
      method: METHOD_VERSION,
    });
  });
}

/**
 * The last seven UTC days of a player, today first: the active time out of
 * the accepted intervals and the successful game actions of the audit log
 * (kept 30 days, so a week is complete).
 */
export function dayTable(ctx: Ctx, uid: string): DayRow[] {
  const now = ctx.now();
  const oldest = weekStart(now);
  const days = dailyMs(
    ctx.playtime.active(uid, oldest, FOREVER),
    now,
    DAYS_SHOWN,
  );
  const counted = ctx.db
    .prepare(
      `SELECT time - time % ? AS day, COUNT(*) AS actions FROM audit_events
       WHERE actor = ? AND category = 'game' AND outcome = 'ok' AND time >= ?
       GROUP BY day`,
    )
    .all(DAY_MS, uid, oldest) as { day: number; actions: number }[];
  const actions = new Map(counted.map((r) => [r.day, r.actions]));
  return days.map((d) => ({
    day: d.day,
    activeMs: d.ms,
    actions: actions.get(d.day) ?? 0,
  }));
}

/** The estimated active time of every player in the days shown, for the admin. */
export function weekMs(ctx: Ctx): Map<string, number> {
  const now = ctx.now();
  const from = weekStart(now);
  const by = new Map<string, Interval[]>();
  for (const [uid, interval] of ctx.playtime.activeOfAll(from, FOREVER))
    by.set(uid, [...(by.get(uid) ?? []), interval]);
  return new Map(
    [...by].map(([uid, list]) => [uid, activeMs(list, from, FOREVER)]),
  );
}

/** The own statistics of `u`; the account comes from the session, never from the request. */
export function ownActivity(ctx: Ctx, u: User): OwnActivity {
  const round = roundOf(ctx);
  return {
    method: METHOD_VERSION,
    now: ctx.now(),
    since: ctx.playtime.firstStart(u.id),
    last: ctx.playtime.lastActiveEnd(u.id),
    round,
    roundMs: activeMs(ctx.playtime.active(u.id, 0, FOREVER, round), 0, FOREVER),
    totalMs: activeMs(ctx.playtime.active(u.id, 0, FOREVER), 0, FOREVER),
    days: dayTable(ctx, u.id),
  };
}
