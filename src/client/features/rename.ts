// „Umbenennen“ of the shown planet or moon: the button opens a dialog with
// the name, its button sends it.
import { MAX_PLANET_NAME, planetNameError } from '../../core/planet-name.ts';
import { val } from '../dom.ts';
import { esc } from '../logic/format.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

export const clientFeature = {
  acts: ({ act, modal }) => ({
    rename: () =>
      modal(
        `<p><b>${client.view!.P.kind === 'moon' ? 'Mond' : 'Planet'} umbenennen</b></p><input id="rn" maxlength="${MAX_PLANET_NAME}" value="${esc(client.view!.P.name)}" aria-label="Neuer Name"> <button data-act="doRename">OK</button> <button data-act="closeModal">Abbrechen</button>`,
      ),
    doRename: () => {
      const n = val('#rn').trim();
      modal('');
      // The check of the server (#214); the browser refuses without a note.
      if (!planetNameError(n)) void act('rename', { name: n });
    },
  }),
} satisfies ClientFeature;
