// „Problem melden“ (issue #126): the button of an error toast opens the form
// in a dialog, filled from the error message; the form of the help page and
// the one of the dialog send the report. The markup is in
// logic/error-report.ts.
import { $ } from '../dom.ts';
import { reportFormHTML } from '../logic/error-report.ts';
import { optionsForm } from '../logic/options-form.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientCtx, ClientFeature } from './contract.ts';

const ui = client.ui;

async function submitReport(
  { api, modal, toast }: ClientCtx,
  id: string,
): Promise<void> {
  const form = $<HTMLFormElement>(`#${id}`);
  if (!form) return;
  try {
    const j = await api('/api/report', Object.fromEntries(new FormData(form)));
    // A redraw while the report was on its way (the poll of the state) put
    // the typed text into a new form: empty the one the player sees, and the
    // text the form of the help page keeps (#332).
    ($<HTMLFormElement>(`#${id}`) ?? form).reset();
    if (id === 'reportform') optionsForm.report = '';
    // Close the dialog only if it is still this one, not one opened since.
    if (id === 'reportform-dialog' && form.isConnected) modal('');
    toast(String(j.msg));
  } catch (e) {
    toast((e as Error).message, e as Error);
  }
}

/** The data-act handler of the button and the forms that send a report. */
export const clientFeature = {
  acts: ({ modal }) => ({
    // The form „Problem melden“ in a dialog, filled from the error message.
    reportProblem: (d) => {
      modal(
        reportFormHTML('reportform-dialog', {
          source: 'toast',
          page: d.page ?? ui.view,
          version: ui.news?.version ?? '',
          requestId: d.request || null,
          message: d.message,
        }) + '<button type="button" data-act="closeModal">Abbrechen</button>',
      );
      $('#reportform-dialog-text')?.focus();
    },
  }),
  forms: (ctx) => ({
    reportform: () => submitReport(ctx, 'reportform'),
    'reportform-dialog': () => submitReport(ctx, 'reportform-dialog'),
  }),
} satisfies ClientFeature;
