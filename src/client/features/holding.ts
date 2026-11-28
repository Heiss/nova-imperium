// „Wache stellen“ for the host (#440, 230b): „Wegschicken“ under „Gehaltene
// Flotten“ sends a hold away, and the checkbox „Keine Wachen annehmen“ of
// „Optionen“ saves at once.
import { holdSaver, shownRefused } from '../logic/options/holding.ts';
import { setField } from '../dom.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  listen: (ctx) => {
    // One save at a time, the newest click last and shown while it runs
    // (CodeRabbit on #455); the page shows the server's option after it.
    const saveOption = holdSaver(client.ui, (on: boolean) =>
      ctx.act('holdOption', { on }),
    );
    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset?.chg !== 'holdOption' || !client.game) return;
      // Saved, refused or thrown: the page renders, and the box shows the
      // option as kept. Svelte writes `checked` only when its value changes,
      // and a refused save renders the value from before the click (PR #469).
      void saveOption(el.checked)
        .catch((err: unknown) =>
          ctx.toast((err as Error).message, err as Error),
        )
        .finally(() => {
          ctx.render();
          if (client.game)
            setField(el, String(shownRefused(client.game, client.ui)));
        });
    });
  },
  acts: ({ act }) => ({
    sendAway: (d) => act('sendAway', { id: d.id }),
  }),
} satisfies ClientFeature;
