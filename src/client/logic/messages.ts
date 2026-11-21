// What the list of reports („Nachrichten“) shows (#118, bundle 4;
// okf/architecture/patterns.md, section 9), without the HTML of its parts:
// the reports newest first, each with its title, time, whether it is new and
// whether the player opened it, and its body. The component Messages renders
// it; the buttons carry data-act (features/reports.ts).
import { dt } from './format.ts';
import { newestFirst } from './game.ts';
import { UPDATE_LINK } from './news.ts';
import { reportBody, type ReportBody } from './report-body.ts';
import type { Report } from './types.ts';
import type { V } from '../views/common.ts';

/** The body of a report: a text, an update message with its link, or the values of a battle, espionage or survey report. */
type MessageBody =
  | { kind: 'text'; text: string }
  | { kind: 'update'; lines: string[]; link: string }
  | { kind: 'report'; body: ReportBody };

/** One report of the list. */
interface ReportRow {
  id: string;
  title: string;
  time: string;
  /** It came after the player last read the reports. */
  fresh: boolean;
  open: boolean;
  body: MessageBody;
}

export interface MessagesPage {
  count: number;
  rows: ReportRow[];
}

/** The lines of a text, split at its line breaks. */
const linesOf = (text: unknown): string[] => String(text ?? '').split('\n');

function bodyOf(r: Report): MessageBody {
  const body = reportBody(r);
  if (body !== null) return { kind: 'report', body };
  if (typeof r.news === 'string')
    return { kind: 'update', lines: linesOf(r.text), link: UPDATE_LINK };
  return { kind: 'text', text: String(r.text ?? '') };
}

/** The list of reports of the player, newest first. */
export function messagesPage(v: V): MessagesPage {
  const readAt = v.s.me.readAt || 0;
  const rows = newestFirst(v.s.reports).map((r) => ({
    id: r.id,
    title: r.title,
    time: dt(r.time),
    fresh: r.time > readAt,
    open: !!v.ui.openRep[r.id],
    body: bodyOf(r),
  }));
  return { count: rows.length, rows };
}
