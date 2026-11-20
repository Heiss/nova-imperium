// The share of a producer on the overview (#118, package 8; formerly in
// main.ts): choosing a percentage in the table sends it at once. The select
// is `data-nokeep`: after the answer it shows the state of the server.
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  listen: ({ act }) => {
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLSelectElement;
      if (el.dataset?.chg === 'pct' && client.game)
        void act('pct', { key: el.dataset.k, v: el.value });
    });
  },
  acts: () => ({}),
} satisfies ClientFeature;
