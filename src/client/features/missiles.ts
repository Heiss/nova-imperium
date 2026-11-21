// The two actions of the Raketenangriff on the Sternenkarte (#54): the button
// opens the form in the dialog, its button sends the order. The form is in
// views/missiles.ts, the order is built in logic/missiles.ts. The two of
// „Verschrotten“ in the lists of the shipyard (2026-11-21) are here too.
import { val } from '../dom.ts';
import { launchOrder, tearDownNote } from '../logic/missiles.ts';
import { client } from '../logic/state.svelte.ts';
import { missileForm, tearDownDialog } from '../views/missiles.ts';
import type { ClientFeature } from './contract.ts';

const value = (id: string): string =>
  document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';

/** The actions of the button and of the form. */
export const clientFeature = {
  acts: ({ modal, actHere, setInput, toast }) => ({
    gmissile: (d) => {
      const pl = client.game?.galaxy.find((x) => x.id === d.id);
      if (pl && client.view) modal(missileForm(client.view, pl));
    },
    doMissile: (d) => {
      const order = launchOrder(d, value('mi_n'), value('mi_aim'));
      modal('');
      return actHere('missile', order);
    },
    // Tearing stored missiles down (#54, 2026-11-21): the amount typed in the
    // row, checked as the server checks it, then a confirmation.
    tearDown: (d) => {
      const n = Number(val(`#td_${d.k}`));
      const note = client.view ? tearDownNote(client.view.P, d.k!, n) : null;
      if (note) return toast(note, true);
      if (client.view) modal(tearDownDialog(d.k!, n));
    },
    doTearDown: async (d) => {
      modal('');
      if (await actHere('tearDownMissiles', { key: d.k, n: Number(d.n) }))
        setInput(`#td_${d.k}`, '');
    },
  }),
} satisfies ClientFeature;
