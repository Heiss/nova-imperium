// The buttons of the build queue, the research and the shipyard: ordering a
// building or a research, cancelling it, and ordering ships or defences with
// the count typed. The lists are mounted from logic/catalog-list.ts.
import { val } from '../dom.ts';
import { orderNote } from '../logic/catalog-list.ts';
import { clampInt } from '../logic/format.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ act, actHere, setInput, toast }) => ({
    build: (d) => act('build', { key: d.k }),
    cancelBuild: () => act('cancelBuild'),
    research: (d) => act('research', { key: d.k }),
    cancelResearch: () => act('cancelResearch'),
    // An order of the shipyard, by its position and unit (#258).
    cancelOrder: (d) => act('cancelOrder', { pos: Number(d.pos), key: d.k }),
    maxq: (d) => setInput(`#q_${d.k}`, d.max ?? 0),
    order: async (d) => {
      const n = clampInt(val(`#q_${d.k}`), 0, 1e9);
      const note = orderNote(client.view!, d.k!, n);
      if (note) return toast(note, true);
      if (await actHere('order', { key: d.k, n })) setInput(`#q_${d.k}`, '');
    },
  }),
} satisfies ClientFeature;
