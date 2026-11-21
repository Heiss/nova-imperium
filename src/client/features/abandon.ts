// The browser side of „Kolonie aufgeben“ (#224), out of main.ts (ratchet
// #242): the button opens the confirmation, its form sends the planet it
// was opened for, with its founding time, and the password and closes on
// success. The markup is in logic/abandon.ts.
import { abandonDialog } from '../logic/abandon.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

const value = (sel: string): string =>
  document.querySelector<HTMLInputElement>(sel)?.value ?? '';

/** The data-act handlers of „Kolonie aufgeben“; its form is handled here too. */
export const clientFeature = {
  listen: ({ act, modal }) => {
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form.id !== 'abandonform') return;
      e.preventDefault();
      const data = {
        target: form.dataset.target,
        created: Number(form.dataset.created),
        password: value('#abandon-password'),
      };
      void act('abandon', data).then((done) => done && modal(''));
    });
  },
  acts: ({ modal }) => ({
    abandon: () => modal(abandonDialog(client.view!.P, client.game!)),
  }),
} satisfies ClientFeature;
