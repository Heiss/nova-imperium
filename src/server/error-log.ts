// The error log (issue #126): unexpected server errors, browser errors of
// signed-in players and their problem reports. Kept 30 days like the audit
// log (purgeAudit). Every text is scrubbed before it is stored: no
// passwords, session or invitation tokens, email login codes or email
// addresses; request bodies are never stored.
import {
  CLIENT_ERROR_KINDS,
  ERROR_FIELDS as MAX,
} from '../shared/error-log.ts';
import { DAY, pageWindow } from './audit.ts';
import type { User } from './db/store.ts';
import { type Ctx, fail, int } from './game/context.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// A value after a name that hints at a secret: password=…, "token": "…".
const SECRET_FIELD =
  /(?<![\w-])([\w-]*(?:passwor[dt]|token|secret|session|cookie|salt|hash|code|challenge|auth|e-?mail)[\w-]*)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}"')\]]+)/gi;
const EMAIL =
  /(?<![^\s@<>()[\]"',;:/\\])[^\s@<>()[\]"',;:/\\]+@[^\s@<>()[\]"',;:/\\]+\.[^\s@<>()[\]"',;:/\\]+/g;
// Starts only at the beginning of a run of token characters, so it stays linear.
const WORD = /(?<![\w-])[\w-]{20,}/g;
// Six digits on their own, like an email login code; not a column of a stack frame.
const CODE = /(?<![\w:.])\d{6}(?![\w:])/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]+/g;
// eslint-disable-next-line no-control-regex
const CONTROL_BUT_LINES = /[\u0000-\u0008\u000b-\u001f\u007f]+/g;

/** Session, invitation and reset tokens are 43 characters, hashes 64. */
function token(word: string): string {
  if (UUID.test(word)) return word;
  const mixed = /\d/.test(word) && /[a-z]/i.test(word);
  return word.length >= 32 || mixed ? '[token]' : word;
}

/** Removes what must never be stored. */
export function scrub(text: string): string {
  return text
    .replace(SECRET_FIELD, '$1$2[redacted]')
    .replace(EMAIL, '[email]')
    .replace(WORD, token)
    .replace(CODE, '[code]');
}

/**
 * A scrubbed, size-limited text. The input is cut a little above the limit
 * first, so a long value costs no time and a secret at the limit is still
 * recognised whole.
 */
export function clean(value: unknown, max: number, lines = false): string {
  const raw = typeof value === 'string' ? value : '';
  const text = raw
    .slice(0, max + 256)
    .replace(lines ? CONTROL_BUT_LINES : CONTROL, lines ? '' : ' ');
  return scrub(text).trim().slice(0, max);
}

const requestId = (value: unknown): string | null =>
  typeof value === 'string' && UUID.test(value) ? value : null;

interface Row {
  kind: 'server' | 'client' | 'report';
  player: string | null;
  requestId: string | null;
  action: string;
  page: string;
  version: string;
  browser: string;
  message: string;
  detail: string;
  report: string;
}

function insert(ctx: Ctx, row: Row): void {
  ctx.store.db
    .prepare(
      `
    INSERT INTO error_events (kind, time, first, player, request_id, action,
      page, version, browser, message, detail, report)
    VALUES (@kind, @now, @now, (SELECT id FROM users WHERE id = @player),
      @requestId, @action, @page, @version, @browser, @message, @detail, @report)
  `,
    )
    .run({ ...row, now: ctx.now() });
}

export interface ServerError {
  /** The route (`POST /api/action`) or the background job (`arrival`). */
  action: string;
  error: unknown;
  /** What the console log says, e.g. which fleet failed. */
  context?: string;
  player?: string | null;
  requestId?: string | null;
  version?: string | null;
}

function describe(error: unknown): { message: string; detail: string } {
  if (error instanceof Error)
    return {
      message: `${error.name}: ${error.message}`,
      detail: error.stack ?? '',
    };
  return { message: String(error), detail: '' };
}

export function recordServerError(ctx: Ctx, e: ServerError): void {
  const { message, detail } = describe(e.error);
  insert(ctx, {
    kind: 'server',
    player: e.player ?? null,
    requestId: requestId(e.requestId),
    action: clean(e.action, MAX.action),
    page: '',
    version: clean(e.version, MAX.version),
    browser: '',
    message: clean(
      e.context ? `${e.context}: ${message}` : message,
      MAX.message,
    ),
    detail: clean(detail, MAX.detail, true),
    report: '',
  });
}

/** Records a server error; a failing write is logged and never thrown. */
export function noteServerError(
  ctx: Ctx,
  e: ServerError,
  log?: (msg: string, e?: unknown) => void,
): void {
  try {
    recordServerError(ctx, e);
  } catch (writeError) {
    log?.('Error log write failed', writeError);
  }
}

/** The fields a signed-in browser sends about itself. */
function fromBrowser(body: Record<string, unknown>, version: string) {
  return {
    requestId: requestId(body.requestId),
    page: clean(body.page, MAX.page),
    version: clean(body.version, MAX.version) || version,
    browser: clean(body.browser, MAX.browser),
  };
}

/**
 * A browser error. An equal error of the same player on the same UTC day
 * (same kind, message, page and version) only raises the counter.
 */
export function recordClientError(
  ctx: Ctx,
  user: User,
  body: Record<string, unknown>,
  version: string,
): void {
  const kind = String(body.kind);
  if (!(CLIENT_ERROR_KINDS as readonly string[]).includes(kind))
    fail('Unbekannte Fehlerart.');
  const row: Row = {
    kind: 'client',
    player: user.id,
    action: kind,
    ...fromBrowser(body, version),
    message: clean(body.message, MAX.message),
    detail: clean(body.detail, MAX.detail, true),
    report: '',
  };
  const now = ctx.now();
  const merged = ctx.store.db
    .prepare(
      `
    UPDATE error_events SET count = count + 1, time = @now
    WHERE id = (
      SELECT id FROM error_events
      WHERE kind = 'client' AND player = @player AND action = @action
        AND message = @message AND page = @page AND version = @version
        AND time >= @today
      ORDER BY id DESC LIMIT 1
    )
  `,
    )
    .run({ ...row, now, today: Math.floor(now / DAY) * DAY });
  if (merged.changes === 0) insert(ctx, row);
}

export type Report = Omit<Row, 'kind' | 'player'>;

/** A problem report as the player sent it; refuses an empty text. */
export function readReport(
  body: Record<string, unknown>,
  version: string,
): Report {
  const report = clean(body.text, MAX.report, true);
  if (!report) fail('Bitte beschreibe kurz, was passiert ist.');
  return {
    action: body.source === 'toast' ? 'toast' : 'form',
    ...fromBrowser(body, version),
    message: clean(body.message, MAX.message),
    detail: '',
    report,
  };
}

export function recordReport(ctx: Ctx, user: User, report: Report): void {
  insert(ctx, { kind: 'report', player: user.id, ...report });
}

const KINDS = ['server', 'client', 'report'];

const ERROR_WHERE = `
  WHERE e.id < @before AND (@kind = '' OR e.kind = @kind)
`;

/** One page of the admin tab „Fehler“, newest first, like the event log. */
export function errorPage(ctx: Ctx, body: Record<string, unknown>) {
  const db = ctx.store.db;
  const last = db
    .prepare('SELECT COALESCE(MAX(id), 0) AS id FROM error_events')
    .get() as { id: number };
  const filter = {
    kind: KINDS.includes(String(body.kind)) ? String(body.kind) : '',
    before: Math.min(
      body.before ? int(body.before, 1, Number.MAX_SAFE_INTEGER) : Infinity,
      last.id + 1,
    ),
  };
  const { count } = db
    .prepare(`SELECT COUNT(*) AS count FROM error_events e ${ERROR_WHERE}`)
    .get(filter) as { count: number };
  const { page, pages, limit, offset } = pageWindow(body, count);
  const errors = db
    .prepare(
      `
    SELECT e.id, e.kind, e.time, e.first, e.player, u.name AS playerName,
      e.request_id AS requestId, e.action, e.page, e.version, e.browser,
      e.message, e.detail, e.count, e.report
    FROM error_events e LEFT JOIN users u ON u.id = e.player
    ${ERROR_WHERE}
    ORDER BY e.id DESC LIMIT @limit OFFSET @offset
  `,
    )
    .all({ ...filter, limit, offset });
  return {
    filter,
    result: { errors, page, pages, count, limit, before: filter.before },
  };
}
