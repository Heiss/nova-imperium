// The estimated active play time on the server (#232, #231,
// okf/features/own-activity.md): the reports of the browser become accepted
// intervals, and every total is derived from the intervals on read. A
// player reads only their own; the admin diagnostics use the same sums.
import { countsAsPlayAction } from '../../core/action-kind.ts';
import { DAY_MS } from '../../core/activity.ts';
import { EVENT_KIND } from '../../core/round-events.ts';
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
import { ADMIN_ACTIONS } from './dispatch.ts';

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
 * The play actions of an account per UTC day since `from`, from the central
 * round journal (#231, #235): the events `journal.action` that succeeded, by
 * the seats the account held in the rounds, kept until the admin deletes the
 * round (the 30-day purge of the audit log does not reach them). What counts
 * is what the audit count counted, narrowed by #335: a succeeded request to an
 * action that is not an admin action and that counts (`countsAsPlayAction`: the
 * changes and the reads the player starts by a click, not the reads a view makes
 * by itself); a refused action (`ok` false), a limited one and an unknown one do
 * not.
 */
function journalActions(
  ctx: Ctx,
  uid: string,
  from: number,
): Map<number, number> {
  const rows = ctx.db
    .prepare(
      `SELECT e.recorded - e.recorded % ? AS day,
         json_extract(e.payload, '$.cause') AS cause, COUNT(*) AS actions
       FROM round_events e
       JOIN round_participants p ON p.round = e.round AND p.seat = e.seat
       WHERE p.player = ? AND e.kind = ? AND e.recorded >= ?
         AND json_extract(e.payload, '$.ok') = 1
       GROUP BY day, cause`,
    )
    .all(DAY_MS, uid, EVENT_KIND.action, from) as {
    day: number;
    cause: string;
    actions: number;
  }[];
  const days = new Map<number, number>();
  for (const r of rows)
    if (!ADMIN_ACTIONS.has(r.cause) && countsAsPlayAction(r.cause))
      days.set(r.day, (days.get(r.day) ?? 0) + r.actions);
  return days;
}

/**
 * The successful actions of the audit log per UTC day since `from` that count
 * as play actions (the same table as the journal, #335; `audit_events.action`
 * holds the action name, `'unknown'` for an unknown one, which does not count,
 * and the rows of `rateLimit` are rejected): only for the days from before the
 * journal existed, which has no count of them. The audit log keeps 30 days.
 */
function auditActions(
  ctx: Ctx,
  uid: string,
  from: number,
): Map<number, number> {
  const rows = ctx.db
    .prepare(
      `SELECT time - time % ? AS day, action, COUNT(*) AS actions
       FROM audit_events
       WHERE actor = ? AND category = 'game' AND outcome = 'ok' AND time >= ?
       GROUP BY day, action`,
    )
    .all(DAY_MS, uid, from) as {
    day: number;
    action: string;
    actions: number;
  }[];
  const days = new Map<number, number>();
  for (const r of rows)
    if (countsAsPlayAction(r.action))
      days.set(r.day, (days.get(r.day) ?? 0) + r.actions);
  return days;
}

/** The first moment the journal recorded an action, null before the first one. */
const journalStart = (ctx: Ctx): number | null =>
  (
    ctx.db
      .prepare('SELECT MIN(recorded) AS t FROM round_events WHERE kind = ?')
      .get(EVENT_KIND.action) as { t: number | null }
  ).t;

/**
 * The last seven UTC days of a player, today first: the active time out of
 * the accepted intervals and the successful game actions out of the round
 * journal (#231). The journal starts with the update that introduced it; a day
 * up to and including the one it started on takes the larger of the journal and
 * the audit log (kept 30 days), the only source of the actions before, so a
 * day from before the journal is not shown as zero.
 */
export function dayTable(ctx: Ctx, uid: string): DayRow[] {
  const now = ctx.now();
  const oldest = weekStart(now);
  const days = dailyMs(
    ctx.playtime.active(uid, oldest, FOREVER),
    now,
    DAYS_SHOWN,
  );
  const journal = journalActions(ctx, uid, oldest);
  const since = journalStart(ctx);
  const before = since === null ? FOREVER : utcDay(since);
  const audit =
    since === null || before >= oldest
      ? auditActions(ctx, uid, oldest)
      : new Map<number, number>();
  return days.map((d) => ({
    day: d.day,
    activeMs: d.ms,
    actions:
      d.day <= before
        ? Math.max(journal.get(d.day) ?? 0, audit.get(d.day) ?? 0)
        : (journal.get(d.day) ?? 0),
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
