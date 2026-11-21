import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetForms } from '../logic/form-state.svelte.ts';
import { optionsForm } from '../logic/options-form.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import { clientFeature } from './report-problem.ts';
import { fakeCtx } from './test-ctx.ts';

type Form = {
  fields: [string, string][];
  reset: () => void;
  isConnected: boolean;
};
let forms: Record<string, Form>;
const focus = vi.fn();

beforeEach(() => {
  forms = {};
  focus.mockClear();
  client.ui.view = 'overview';
  client.ui.news = null;
  vi.stubGlobal(
    'FormData',
    class {
      form: Form;
      constructor(form: Form) {
        this.form = form;
      }
      [Symbol.iterator]() {
        return this.form.fields[Symbol.iterator]();
      }
    },
  );
  vi.stubGlobal('document', {
    querySelector: (sel: string) =>
      sel === '#reportform-dialog-text'
        ? { focus }
        : (forms[sel.slice(1)] ?? null),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  forgetForms();
});

const form = (over: Partial<Form> = {}): Form => ({
  fields: [
    ['text', 'Es hängt.'],
    ['page', 'fleet'],
  ],
  reset: vi.fn(),
  isConnected: true,
  ...over,
});

describe('the button „Problem melden“', () => {
  it('opens the form with the message, the page and the request, and focuses the text', () => {
    const ctx = fakeCtx();
    clientFeature.acts(ctx).reportProblem({
      message: 'Kaputt.',
      page: 'fleet',
      request: 'req-1',
    });
    const html = vi.mocked(ctx.modal).mock.calls[0]![0];
    expect(html).toContain('<form id="reportform-dialog"');
    expect(html).toContain('name="message" value="Kaputt."');
    expect(html).toContain('name="page" value="fleet"');
    expect(html).toContain('name="requestId" value="req-1"');
    expect(html).toContain('data-act="closeModal"');
    expect(focus).toHaveBeenCalled();
  });

  it('takes the shown page and the version of the news when the button names none', () => {
    client.ui.view = 'galaxy';
    client.ui.news = { version: '1.2.3' } as never;
    const ctx = fakeCtx();
    clientFeature.acts(ctx).reportProblem({});
    const html = vi.mocked(ctx.modal).mock.calls[0]![0];
    expect(html).toContain('name="page" value="galaxy"');
    expect(html).toContain('name="version" value="1.2.3"');
    expect(html).toContain('name="requestId" value=""');
  });
});

describe('the forms that send a report', () => {
  it('sends the fields, empties the form, closes the dialog and thanks', async () => {
    forms['reportform-dialog'] = form();
    const ctx = fakeCtx({ api: vi.fn(async () => ({ msg: 'Danke.' })) });
    await clientFeature.forms(ctx)['reportform-dialog']();
    expect(ctx.api).toHaveBeenCalledWith('/api/report', {
      text: 'Es hängt.',
      page: 'fleet',
    });
    expect(forms['reportform-dialog']!.reset).toHaveBeenCalled();
    expect(ctx.modal).toHaveBeenCalledWith('');
    expect(ctx.toast).toHaveBeenCalledWith('Danke.');
  });

  it('keeps a dialog that was replaced by another meanwhile', async () => {
    forms['reportform-dialog'] = form({ isConnected: false });
    const ctx = fakeCtx({ api: vi.fn(async () => ({ msg: 'Danke.' })) });
    await clientFeature.forms(ctx)['reportform-dialog']();
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Danke.');
  });

  it('leaves the form of the help page where it is and thanks', async () => {
    forms.reportform = form();
    optionsForm.report = 'Es ging nicht.';
    const ctx = fakeCtx({ api: vi.fn(async () => ({ msg: 'Danke.' })) });
    await clientFeature.forms(ctx).reportform();
    expect(forms.reportform.reset).toHaveBeenCalled();
    // The text the form keeps is gone too, so a redraw does not bring it back (#332).
    expect(optionsForm.report).toBe('');
    expect(ctx.modal).not.toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Danke.');
  });

  it('empties the form that stands on the page when the answer comes, not the one that was sent', async () => {
    // The poll of the state redraws the page while the report is on its way:
    // the redraw mounts a new form that shows the text of the form state
    // (logic/options-form.svelte.ts, #332), and the old, detached form is no
    // longer the one the player sees.
    const sent = form({ isConnected: false });
    forms.reportform = sent;
    const redrawn = form();
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        forms.reportform = redrawn;
        return { msg: 'Danke.' };
      }),
    });
    await clientFeature.forms(ctx).reportform();
    expect(redrawn.reset).toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Danke.');
  });

  it('does nothing when the form is not on the page', async () => {
    const ctx = fakeCtx();
    await clientFeature.forms(ctx).reportform();
    expect(ctx.api).not.toHaveBeenCalled();
  });

  it('keeps the text and shows the error when the server refuses', async () => {
    forms.reportform = form();
    const ctx = fakeCtx({
      api: vi.fn(async () => {
        throw new Error('Zu oft.');
      }),
    });
    optionsForm.report = 'Es ging nicht.';
    await clientFeature.forms(ctx).reportform();
    expect(forms.reportform.reset).not.toHaveBeenCalled();
    expect(optionsForm.report).toBe('Es ging nicht.');
    expect(ctx.toast).toHaveBeenCalledWith(
      'Zu oft.',
      expect.objectContaining({ message: 'Zu oft.' }),
    );
  });
});
