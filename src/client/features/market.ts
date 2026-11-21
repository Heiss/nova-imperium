// The browser side of the marketplace (#171), out of main.ts (ratchet #242):
// the form keeps its fields as state (logic/market-form.svelte.ts, bound by
// the component, #332), „max“ writes the amount of the most that can be
// given, and „Tauschen“ sends the action trade. The form and its preview are
// views/Market.svelte; the preview is painted by the component from the same
// function the server uses.
import { amountOf, fixed, marketOf, maxAmount } from '../logic/market.ts';
import { draft } from '../logic/market-form.svelte.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

/** The market of the shown planet, or null while no state is shown. */
const current = () =>
  client.view ? marketOf(client.view.s, client.view.P) : null;

/** The data-act handlers of the marketplace; its form is handled here too. */
export const clientFeature = {
  listen: ({ act }) => {
    document.addEventListener('submit', (e) => {
      if ((e.target as HTMLFormElement).id !== 'marketform') return;
      e.preventDefault();
      const d = fixed(draft);
      void act('trade', {
        give: d.give,
        get: d.get,
        amount: amountOf(d.amount),
      }).then((done) => {
        if (done) draft.amount = '';
      });
    });
  },
  acts: () => ({
    marketMax: () => {
      const m = current();
      if (m) draft.amount = maxAmount(m, fixed(draft));
    },
  }),
} satisfies ClientFeature;
