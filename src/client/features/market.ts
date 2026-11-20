// The browser side of the marketplace (#171), out of main.ts (ratchet #242):
// the form keeps its draft in logic/market.ts, every input repaints the
// preview from the same function the server uses, „max“ fills the field with
// the most that can be given, and „Tauschen“ sends the action trade. The
// form is views/Market.svelte; the preview and the options it is painted
// with are in logic/market-page.ts.
import type { Res } from '../../core/market.ts';
import {
  amountOf,
  draft,
  fixed,
  marketOf,
  maxAmount,
  preview,
} from '../logic/market.ts';
import { writeField } from '../field-drafts.ts';
import { previewHTML, targetOptions } from '../logic/market-page.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

const field = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

/** The market of the shown planet, or null while no state is shown. */
const current = () =>
  client.view ? marketOf(client.view.s, client.view.P) : null;

/** Writes the draft into the form, then the preview below it and the state of „Tauschen“. */
function paint(): void {
  const m = current();
  if (!m || !field('marketform')) return;
  const d = fixed(draft);
  field<HTMLSelectElement>('market-get')!.innerHTML = targetOptions(d);
  writeField(field<HTMLInputElement>('market-amount')!, d.amount);
  const p = preview(m, d);
  field('market-preview')!.innerHTML = previewHTML(p);
  field<HTMLButtonElement>('market-trade')!.disabled = !p.ok;
}

/** Reads the form into the draft. */
function read(): void {
  draft.give = field<HTMLSelectElement>('market-give')!.value as Res;
  draft.get = field<HTMLSelectElement>('market-get')!.value as Res;
  draft.amount = field<HTMLInputElement>('market-amount')!.value;
}

/** The data-act handlers of the marketplace; its form is handled here too. */
export const clientFeature = {
  listen: ({ act }) => {
    document.addEventListener('input', (e) => {
      if (!(e.target as HTMLElement).closest('#marketform')) return;
      read();
      paint();
    });
    document.addEventListener('submit', (e) => {
      if ((e.target as HTMLFormElement).id !== 'marketform') return;
      e.preventDefault();
      read();
      const d = fixed(draft);
      void act('trade', {
        give: d.give,
        get: d.get,
        amount: amountOf(d.amount),
      }).then((done) => {
        if (!done) return;
        draft.amount = '';
        paint();
      });
    });
  },
  acts: () => ({
    marketMax: () => {
      const m = current();
      if (!m) return;
      read();
      draft.amount = maxAmount(m, fixed(draft));
      paint();
    },
  }),
} satisfies ClientFeature;
