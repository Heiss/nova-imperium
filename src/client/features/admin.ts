// Buttons of the admin page that need nothing of its panel: the Endzeit
// (F15, #214), the settings of the universe and copying the invitation link.
// The panel with its tabs and the invitations is part of the frame (main.ts).
import { $, val } from '../dom.ts';
import { endzeitNote } from '../logic/endzeit.ts';
import { settingsFrom } from '../logic/game.ts';
import {
  draftsOf,
  forgetDrafts,
  newDraft,
  typed,
} from '../logic/settings-draft.ts';
import { client } from '../logic/state.svelte.ts';
import { endzeitDialog } from '../views/misc.ts';
import type { ClientFeature } from './contract.ts';

const draft = newDraft();

/** The account and round of the shown state: a draft belongs to both. */
const ownerOf = (): string =>
  `${client.game!.me.id}/${client.game!.round.number}`;

/** The setting a field of the form is for, and the value the server has. */
function settingOf(
  target: EventTarget | null,
): { key: string; saved: string } | null {
  const key = (target as HTMLElement | null)?.dataset?.setting;
  if (!key || !client.game?.admin) return null;
  const saved = (client.game.cfg as unknown as Record<string, unknown>)[key];
  return { key, saved: String(saved) };
}

export const clientFeature = {
  acts: ({ act, modal, toast }) => {
    const edited = (e: Event): void => {
      const field = settingOf(e.target);
      if (field)
        typed(
          draft,
          ownerOf(),
          field.key,
          (e.target as HTMLInputElement).value,
          field.saved,
        );
    };
    document.addEventListener('input', edited);
    document.addEventListener('change', edited);
    return {
      endzeit: () => modal(endzeitDialog(client.game!.admin!.endzeit.minutes)),
      doEndzeit: () => {
        const minutes = val('#endzeit-minutes');
        // The check of the server (F15, #214): a refusal without a request.
        const note = endzeitNote(client.game!.admin!.endzeit.done, minutes);
        modal('');
        return note ? toast(note, true) : act('endzeit', { minutes });
      },
      // A refusal keeps what was typed; a saved form shows the server again.
      saveSettings: async () => {
        const keys = client.game!.admin!.specs.map((x) => x.key);
        const saved = await act('settings', {
          settings: settingsFrom(keys, (k) => val(`#set_${k}`)),
        });
        if (saved) forgetDrafts(draft);
        return saved;
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
    };
  },
  // The fields do not keep their value over a redraw; what the admin typed
  // and has not saved goes back into them (logic/settings-draft.ts).
  afterRender: () => {
    if (!client.game?.admin) return;
    for (const [key, value] of draftsOf(draft, ownerOf())) {
      const field = document.getElementById(`set_${key}`);
      if (field) (field as HTMLInputElement).value = value;
    }
  },
} satisfies ClientFeature;
