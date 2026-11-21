// The body of a report as markup, for the tests of the components of the
// reports (#330): rendered on the server side of Svelte, without its comments.
import { render } from 'svelte/server';
import { reportBody } from '../client/logic/report-body.ts';
import type { Report } from '../client/logic/types.ts';
import ReportBody from '../client/views/ReportBody.svelte';
import { stripComments } from './markup.ts';

/** The markup of the body of a report; null for a report that is only text. */
export function reportView(r: Report): string | null {
  const body = reportBody(r);
  return body && stripComments(render(ReportBody, { props: { body } }).body);
}
