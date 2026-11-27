// The transport of the client (#118, package 8; formerly in main.ts): every
// call to the server goes through `api()`. A 401 ends the session, a
// maintenance answer shows the banner, and a busy database is tried once
// more for an action. Every call with a body carries a key of its own in the
// header `Idempotency-Key`, the same on its resend, so the server runs a
// repeated request once (#450). The browser, the banner and the error log are handed
// in, so the rules are tested without a page.
import { apiFailure, type ClientError, failedCall } from './error-report.ts';
import { maintenanceNotice } from './maintenance.ts';

/** The error of a 401: the caller stops, the login is on the page. */
export class AuthError extends Error {}

/**
 * The refusal or failure of one call, with the id the server gave that call:
 * „Problem melden“ of its error message names it, whatever other call
 * answered meanwhile.
 */
export class ApiError extends Error {
  readonly requestId: string | null;
  constructor(message: string, requestId: string | null) {
    super(message);
    this.requestId = requestId;
  }
}

/** The id of the call an error comes from, or null when it is none of a call. */
export const requestIdOf = (error: unknown): string | null =>
  error instanceof ApiError ? error.requestId : null;

/** The pause before a busy action is sent once more, in milliseconds. */
export const RETRY_AFTER_MS = 300;

export interface TransportDeps {
  fetch: typeof fetch;
  /** Reports a failed call to the error log. */
  report: (error: ClientError) => void;
  /** The server is in maintenance: shows the banner. */
  maintenance: (text: string) => void;
  /** The session is gone: shows the login, then throws to stop the caller. */
  signedOut: (error: unknown) => never;
  /** The id the server gave this request, for „Problem melden“. */
  requestId: (id: string) => void;
  wait: (ms: number) => Promise<void>;
  /** A new key for one call with a body (#450): `crypto.randomUUID()`. */
  key: () => string;
}

type Body = Record<string, unknown>;

/** Whether the answer is the busy database of an action that may be sent once more. */
const isRetryableAction = (
  response: Response,
  body: Body,
  retry: boolean,
): boolean =>
  retry && response.status === 503 && body.code === 'ACTION_DB_BUSY';

/** The error of a refusal: the server's words, a server error with its id in the text. */
function apiError(response: Response, error: unknown): ApiError {
  const id = response.headers.get('x-request-id');
  const shown = response.status >= 500 && id ? ` Vorgang: ${id}` : '';
  return new ApiError(String(error ?? 'Fehler') + shown, id);
}

/** One request: a GET, or a POST with its body and its key (#450). */
async function request(
  deps: TransportDeps,
  url: string,
  body: unknown,
  key: string | undefined,
): Promise<Response> {
  try {
    return await deps.fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: key
        ? { 'content-type': 'application/json', 'idempotency-key': key }
        : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (error) {
    deps.report(apiFailure(url, null));
    throw error;
  }
}

/** The call `api(url, body?)`: a GET, or a POST with a body; the answer is the JSON. */
export function createApi(
  deps: TransportDeps,
): (url: string, body?: unknown, retryBusy?: boolean) => Promise<Body> {
  async function call(
    url: string,
    body: unknown,
    retryBusy: boolean,
    key: string | undefined,
  ): Promise<Body> {
    const r = await request(deps, url, body, key);
    const id = r.headers.get('x-request-id');
    if (id) deps.requestId(id);
    const j = (await r
      .json()
      .catch(() => ({ error: 'Keine Antwort vom Server.' }))) as Body;
    const notice = maintenanceNotice(
      r.status,
      r.headers.get('nova-maintenance'),
      j,
    );
    if (notice) {
      deps.maintenance(notice);
      throw new Error(notice);
    }
    if (r.status === 401) deps.signedOut(j.error);
    if (isRetryableAction(r, j, retryBusy)) {
      await deps.wait(RETRY_AFTER_MS);
      // The same key: the server runs the action once whatever arrives.
      return call(url, body, false, key);
    }
    if (!r.ok) {
      if (failedCall(r.status))
        deps.report(apiFailure(url, r.status, r.headers.get('x-request-id')));
      throw apiError(r, j.error);
    }
    return j;
  }
  // One key per call with a body, made before the first try.
  return (url, body, retryBusy = true) =>
    call(url, body, retryBusy, body ? deps.key() : undefined);
}
