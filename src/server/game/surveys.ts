// The cleanup of the surveys (#190, D1): if nobody colonized a surveyed
// position, its values and the reports of its survey are deleted after 30
// days; a later survey rolls new values. Runs in the hourly sweep, like the
// audit retention.
import { SURVEY_DAYS } from '../../core/survey.ts';
import { DAY } from '../audit.ts';
import type { Ctx } from './context.ts';

/** Deletes the surveys older than 30 days with their reports. */
export function purgeSurveys(ctx: Ctx): void {
  ctx.tx(() => {
    const gone = ctx.surveys.expire(ctx.now() - SURVEY_DAYS * DAY);
    ctx.reports.deleteSurveys(gone);
  });
}
