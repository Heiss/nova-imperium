// The buttons of the list of reports (views/messages.ts): a report opens and
// closes, one is deleted, all are deleted.
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ act }) => ({
    toggleRep: (d) => {
      client.ui.openRep[d.id!] = !client.ui.openRep[d.id!];
      document.getElementById(`rep_${d.id}`)?.classList.toggle('open');
    },
    delrep: (d) => act('delrep', { id: d.id }),
    delall: () => act('delall'),
  }),
} satisfies ClientFeature;
