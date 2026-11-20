// The activity sample (#229; formerly in main.ts): a click or key of a
// signed-in player on a visible page tells the server, at most every 10
// seconds. It never changes the session UI or blocks the interaction.
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

const EVERY_MS = 10000;

export const clientFeature = {
  acts: () => {
    let last = -Infinity;
    const note = (event: Event): void => {
      if (!client.game) {
        last = -Infinity;
        return;
      }
      if (!event.isTrusted || document.visibilityState !== 'visible') return;
      const now = performance.now();
      if (now - last < EVERY_MS) return;
      last = now;
      void fetch('/api/activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        credentials: 'same-origin',
      }).catch(() => undefined);
    };
    document.addEventListener('click', note, { capture: true });
    document.addEventListener('keydown', note, { capture: true });
    return {};
  },
} satisfies ClientFeature;
