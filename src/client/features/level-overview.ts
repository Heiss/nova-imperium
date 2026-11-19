// The ▤ of the level overview (#187): the button next to the „?“ of a
// building or research unfolds or folds the table of its next levels. What
// is unfolded is kept while the page is open, not stored; the option
// „Stufenübersicht“ (features/options.ts) decides whether there is a ▤ at all.
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: () => ({
    levels: (d) => {
      const key = d.k;
      if (!key) return;
      const { openLv = {} } = client.ui;
      client.ui.openLv = { ...openLv, [key]: !openLv[key] };
      // The list renders again from a new view state, as the „?“ does.
      if (client.shown) client.shown = { ...client.shown };
    },
  }),
} satisfies ClientFeature;
