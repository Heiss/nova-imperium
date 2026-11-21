// The error log of the client (issue #126; formerly in main.ts): script
// errors, unhandled rejections and failed calls go to the server. Sent with
// fetch, never through api(), so a failing report cannot loop.
import {
  type ClientError,
  createReporter,
  describeError,
  ERRORS_URL,
} from './logic/error-report.ts';
import { client } from './logic/state.svelte.ts';

export const reportError: (error: ClientError) => void = createReporter({
  send: (body) =>
    fetch(ERRORS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    }),
  context: () => ({
    signedIn: client.game !== null,
    page: client.ui.view,
    version: client.ui.news?.version ?? '',
    browser: navigator.userAgent,
  }),
  now: Date.now,
});

/** Reports the errors of the page itself. */
export function watchErrors(): void {
  window.addEventListener('error', (event) =>
    reportError({
      kind: 'error',
      ...describeError(event.error ?? event.message),
    }),
  );
  window.addEventListener('unhandledrejection', (event) =>
    reportError({ kind: 'rejection', ...describeError(event.reason) }),
  );
}
