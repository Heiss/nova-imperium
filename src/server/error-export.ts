// The download of the admin tab „Fehler“ (issue #126): one ZIP built with
// fflate, one JSON Lines file per kind (errors, problem reports, audit log)
// for a time range, by default the last 7 days. Player names are included;
// the stored texts are already scrubbed (error-log.ts), audit entries never
// hold secrets (audit.ts).
import { strToU8, zipSync } from 'fflate';
import { DAY } from './audit.ts';
import { type Ctx, int } from './game/context.ts';

const DEFAULT_DAYS = 7;

export function exportRange(body: Record<string, unknown>, now: number) {
  const until = body.until ? int(body.until, 0, now) : now;
  const since = body.since
    ? int(body.since, 0, until)
    : Math.max(0, until - DEFAULT_DAYS * DAY);
  return { since, until };
}

type Range = ReturnType<typeof exportRange>;
type Line = Record<string, unknown>;

const iso = (time: number): string => new Date(time).toISOString();
const jsonLines = (rows: Line[]): string =>
  rows.map((row) => JSON.stringify(row) + '\n').join('');

function errorLines(ctx: Ctx, range: Range, reports: boolean): Line[] {
  const rows = ctx.store.db
    .prepare(
      `
    SELECT e.id, e.kind, e.time, e.first, u.name AS player, e.player AS playerId,
      e.request_id AS requestId, e.action, e.page, e.version, e.browser,
      e.message, e.detail, e.count, e.report
    FROM error_events e LEFT JOIN users u ON u.id = e.player
    WHERE e.time BETWEEN @since AND @until
      AND (e.kind = 'report') = @reports
    ORDER BY e.id
  `,
    )
    .all({ ...range, reports: Number(reports) }) as Line[];
  return rows.map(({ time, first, report, detail, count, ...row }) =>
    reports
      ? { ...row, time: iso(Number(time)), text: report }
      : {
          ...row,
          time: iso(Number(time)),
          first: iso(Number(first)),
          detail,
          count,
        },
  );
}

function auditLines(ctx: Ctx, range: Range): Line[] {
  const rows = ctx.store.db
    .prepare(
      `
    SELECT e.id, e.time, a.name AS actor, e.actor AS actorId, e.category,
      e.action, e.outcome, t.name AS target, e.target AS targetId,
      e.request_id AS requestId, e.detail
    FROM audit_events e LEFT JOIN users a ON a.id = e.actor
      LEFT JOIN users t ON t.id = e.target
    WHERE e.time BETWEEN @since AND @until
    ORDER BY e.id
  `,
    )
    .all(range) as Line[];
  return rows.map(({ time, detail, ...row }) => ({
    ...row,
    time: iso(Number(time)),
    detail: JSON.parse(String(detail)) as unknown,
  }));
}

/** The ZIP for the range; the counts go into the audit entry. */
export function errorExport(ctx: Ctx, range: Range) {
  const errors = errorLines(ctx, range, false);
  const reports = errorLines(ctx, range, true);
  const audit = auditLines(ctx, range);
  const day = (time: number): string => iso(time).slice(0, 10);
  return {
    name: `nova-imperium-fehler-${day(range.since)}-${day(range.until)}.zip`,
    zip: zipSync({
      'errors.jsonl': strToU8(jsonLines(errors)),
      'reports.jsonl': strToU8(jsonLines(reports)),
      'audit.jsonl': strToU8(jsonLines(audit)),
    }),
    counts: {
      errors: errors.length,
      reports: reports.length,
      audit: audit.length,
    },
  };
}
