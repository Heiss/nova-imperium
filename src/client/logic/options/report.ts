// „Optionen“, the data of the form „Problem melden“
// (features/report-problem.ts sends it).
import { ERROR_FIELDS } from '../../../core/error-log.ts';
import { reportContextText } from '../error-report.ts';
import type { OptionsState } from './state.ts';

/** The form „Problem melden“: what it sends along and shows above the text. */
interface ReportForm {
  page: string;
  version: string;
  requestId: string;
  /** The line above the field: page, version and last request. */
  context: string;
  /** The longest report the server takes. */
  max: number;
}

/** The part of the page the box shows. */
export interface ReportPart {
  report: ReportForm;
}

/** The form with the page, the version and the last request. */
export function reportForm({ ui }: OptionsState): ReportPart {
  const requestId = ui.lastRequestId ?? null;
  const version = ui.news?.version ?? '';
  return {
    report: {
      page: ui.view,
      version,
      requestId: requestId ?? '',
      context: reportContextText({ page: ui.view, version, requestId }),
      max: ERROR_FIELDS.report,
    },
  };
}
