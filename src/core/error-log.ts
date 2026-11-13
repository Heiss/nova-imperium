// Limits of the error log (issue #126), shared by the server, which enforces
// them, and the browser, which trims before it sends.

/** Most characters stored per field; longer values are cut. */
export const ERROR_FIELDS = {
  message: 500,
  detail: 4000,
  page: 40,
  version: 20,
  browser: 200,
  action: 80,
  report: 1000,
} as const;

/** What the browser reports: script errors, unhandled rejections, failed API calls. */
export const CLIENT_ERROR_KINDS = ['error', 'rejection', 'api'] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];

/** Browser errors per player: at most 20 a minute and 200 a day. */
export const CLIENT_ERRORS_PER_MINUTE = 20;
export const CLIENT_ERRORS_PER_DAY = 200;
/** Problem reports per player and hour. */
export const REPORTS_PER_HOUR = 5;
