// The two actions of the Raketenangriff on the Sternenkarte (#54): the button
// opens the form in the dialog, its button sends the order. The form is in
// views/missiles.ts, the order is built in logic/missiles.ts.
import { launchOrder } from '../logic/missiles.ts';
import { client } from '../logic/state.svelte.ts';
import { missileForm } from '../views/missiles.ts';
import type { ClientFeature } from './contract.ts';

const value = (id: string): string =>
  document.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';

/** The actions of the button and of the form. */
export const clientFeature = {
  acts: ({ modal, actHere }) => ({
    gmissile: (d) => {
      const pl = client.game?.galaxy.find((x) => x.id === d.id);
      if (pl && client.view) modal(missileForm(client.view, pl));
    },
    doMissile: (d) => {
      const order = launchOrder(d, value('mi_n'), value('mi_aim'));
      modal('');
      return actHere('missile', order);
    },
  }),
} satisfies ClientFeature;
