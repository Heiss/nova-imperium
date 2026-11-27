// „Wache stellen“ for the host (#440, 230b): „Wegschicken“ under „Gehaltene
// Flotten“ sends a hold away, and the checkbox „Keine Wachen annehmen“ of
// „Optionen“ saves at once.
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  listen: (ctx) => {
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset?.chg === 'holdOption' && client.game)
        void ctx.act('holdOption', { on: el.checked });
    });
  },
  acts: ({ act }) => ({
    sendAway: (d) => act('sendAway', { id: d.id }),
  }),
} satisfies ClientFeature;
