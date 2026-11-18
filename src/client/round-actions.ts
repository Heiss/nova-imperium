// The browser side of the dialog „Neue Runde“ (#283), out of main.ts
// (ratchet #242): it shows one field per setting of the registry
// `ROUND_SETTINGS` and sends what the admin chose. A feature with a value
// per round adds its registry entry and changes nothing here.
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundFieldId,
  roundRequest,
} from '../core/round.ts';
import { client } from './logic/state.svelte.ts';
import { roundDialog } from './views/misc.ts';

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
}

const field = (s: RoundSetting): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(`#${roundFieldId(s)}`);

/** The values of the open dialog: a checkbox yes or no, a field as a number. */
const dialogValues = (): Record<string, number | boolean> =>
  Object.fromEntries(
    ROUND_SETTINGS.map((s) => [
      s.name,
      s.kind === 'switch' ? !!field(s)?.checked : Number(field(s)?.value ?? ''),
    ]),
  );

/** The data-act handlers of „Neue Runde“. */
export const roundActs = ({ act, modal }: Deps) => ({
  reset: () => modal(roundDialog(client.game!.round)),
  doReset: () => {
    // Read before the dialog closes with its fields.
    const data = roundRequest(dialogValues());
    modal('');
    return act('reset', data);
  },
});
