// Problems of signed-in players for the error log (issue #126): script
// errors, unhandled rejections and failed API calls go to the server on
// their own; a player can add a problem report with a text. Nothing is sent
// while nobody is signed in (the login page).
import {
  CLIENT_ERRORS_PER_MINUTE,
  ERROR_FIELDS,
  type ClientErrorKind,
} from '../../core/error-log.ts';
import { esc } from './format.ts';

export const ERRORS_URL = '/api/errors';

export interface ClientError {
  kind: ClientErrorKind;
  message: string;
  detail: string;
  requestId?: string | null;
}

/** Message and stack of whatever was thrown or rejected. */
export function describeError(reason: unknown): {
  message: string;
  detail: string;
} {
  if (reason instanceof Error)
    return {
      message: `${reason.name}: ${reason.message}`,
      detail: reason.stack ?? '',
    };
  try {
    return { message: String(reason), detail: '' };
  } catch {
    return { message: 'Unprintable error', detail: '' };
  }
}

/**
 * A failed API call: an answer of 500 or more (status), or none at all
 * (null). The query is left out; it may name a planet but adds nothing.
 */
export function apiFailure(
  url: string,
  status: number | null,
  requestId: string | null = null,
): ClientError {
  const path = url.split('?')[0]!;
  const message =
    status === null ? `No answer: ${path}` : `HTTP ${status}: ${path}`;
  return { kind: 'api', message, detail: '', requestId };
}

/** Whether a failed answer is one for the error log (not a refusal or 401). */
export const failedCall = (status: number): boolean => status >= 500;

export interface ReporterOptions {
  /** Sends the report; its failure is swallowed, never reported again. */
  send: (body: object) => Promise<unknown>;
  context: () => {
    signedIn: boolean;
    page: string;
    version: string;
    browser: string;
  };
  now: () => number;
}

const cut = (text: string, max: number): string => text.slice(0, max);

/**
 * Returns the function that reports an error: only while signed in, at most
 * 20 a minute like the server allows, and never an error of its own.
 */
export function createReporter(
  o: ReporterOptions,
): (error: ClientError) => void {
  let start = -Infinity;
  let sent = 0;
  let busy = false;
  return (error) => {
    if (busy) return;
    busy = true;
    try {
      const c = o.context();
      const t = o.now();
      if (t - start >= 60000) {
        start = t;
        sent = 0;
      }
      if (!c.signedIn || ++sent > CLIENT_ERRORS_PER_MINUTE) return;
      void o
        .send({
          kind: error.kind,
          message: cut(error.message, ERROR_FIELDS.message),
          detail: cut(error.detail, ERROR_FIELDS.detail),
          requestId: error.requestId ?? null,
          page: cut(c.page, ERROR_FIELDS.page),
          version: cut(c.version, ERROR_FIELDS.version),
          browser: cut(c.browser, ERROR_FIELDS.browser),
        })
        .catch(() => undefined);
    } catch {
      // A failing report must not raise the next error.
    } finally {
      busy = false;
    }
  };
}

export interface ReportContext {
  /** „Hilfe & Optionen“ (form) or an error message (toast). */
  source: 'form' | 'toast';
  page: string;
  version: string;
  requestId: string | null;
  /** The error message that offered the report. */
  message?: string;
}

/** What the report sends along, shown above the text. */
export function reportContextLine(c: ReportContext): string {
  const parts = [
    `Seite: ${esc(c.page)}`,
    `Version: ${esc(c.version || 'unbekannt')}`,
    `Letzter Vorgang: ${esc(c.requestId ?? '–')}`,
  ];
  if (c.message) parts.push(`Meldung: ${esc(c.message)}`);
  return parts.join(' · ');
}

const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${esc(value)}">`;

/** The form „Problem melden“: in „Hilfe & Optionen“ and behind an error message. */
export function reportFormHTML(id: string, c: ReportContext): string {
  return `<form id="${id}" class="report-form">
 ${hidden('source', c.source)}${hidden('page', c.page)}${hidden('version', c.version)}${hidden('requestId', c.requestId ?? '')}${hidden('message', c.message ?? '')}
 <p class="dim">${reportContextLine(c)}</p>
 <label for="${id}-text">Was ist passiert?</label><br>
 <textarea id="${id}-text" name="text" maxlength="${ERROR_FIELDS.report}" rows="4" required></textarea>
 <p><button type="submit">Absenden</button></p></form>`;
}
