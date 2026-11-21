// The address to invite and the message to all players of the page „Admin“
// keep what was typed over the redraw of the poll (#332): the component shows
// the state of logic/admin-form.svelte.ts.
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_UNIVERSE } from '../../core/universe.ts';
import { adminMarkup } from '../../test/admin-view.ts';
import { adminForm } from '../logic/admin-form.svelte.ts';
import { forgetForms } from '../logic/form-state.svelte.ts';
import type { V } from './common.ts';

afterEach(forgetForms);

const page = (): string =>
  adminMarkup({
    s: {
      cfg: { ...DEFAULT_UNIVERSE },
      admin: { specs: [], endzeit: { minutes: 1, done: false } },
    },
    ui: {},
  } as unknown as V);

const field = (html: string, id: string): string =>
  new RegExp(`<input [^>]*id="${id}"[^>]*>`).exec(html)![0];

describe('the forms of „Admin“', () => {
  it('are empty while nothing was typed', () => {
    const html = page();
    expect(field(html, 'inv_email')).not.toContain('value');
    expect(html).toMatch(/<textarea[^>]*id="announce-text"[^>]*><\/textarea>/);
  });

  it('show what was typed, escaped', () => {
    adminForm.invite = 'a@b.de';
    adminForm.announce = 'Wartung <heute> & morgen';
    const html = page();
    expect(field(html, 'inv_email')).toContain('value="a@b.de"');
    expect(html).toMatch(
      /id="announce-text"[^>]*>Wartung &lt;heute> &amp; morgen<\/textarea>/,
    );
  });
});
