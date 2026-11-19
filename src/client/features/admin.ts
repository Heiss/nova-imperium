// Buttons of the admin page that need nothing of its panel: the Endzeit
// (F15, #214), the settings of the universe and copying the invitation link.
// The panel with its tabs and the invitations is part of the frame (main.ts).
import { $, val } from '../dom.ts';
import { endzeitNote } from '../logic/endzeit.ts';
import { settingsFrom } from '../logic/game.ts';
import { client } from '../logic/state.svelte.ts';
import { endzeitDialog } from '../views/misc.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ act, modal, toast }) => ({
    endzeit: () => modal(endzeitDialog(client.game!.admin!.endzeit.minutes)),
    doEndzeit: () => {
      const minutes = val('#endzeit-minutes');
      // The check of the server (F15, #214): a refusal without a request.
      const note = endzeitNote(client.game!.admin!.endzeit.done, minutes);
      modal('');
      return note ? toast(note, true) : act('endzeit', { minutes });
    },
    saveSettings: () => {
      const keys = client.game!.admin!.specs.map((x) => x.key);
      return act('settings', {
        settings: settingsFrom(keys, (k) => val(`#set_${k}`)),
      });
    },
    copyLink: async () => {
      const input = $<HTMLInputElement>('#inv_link');
      if (!input) return;
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        toast('Link kopiert.');
      } catch {
        toast('Bitte den markierten Link selbst kopieren.', true);
      }
    },
  }),
} satisfies ClientFeature;
