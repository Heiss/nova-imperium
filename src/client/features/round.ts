// The browser side of the dialog „Neue Runde“ (#283), out of main.ts
// (ratchet #242): it shows one field per setting of the registry
// `ROUND_SETTINGS` and sends what the admin chose. A feature with a value
// per round adds its registry entry and changes nothing here.
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundFieldId,
  roundRequest,
} from '../../core/round.ts';
import { client } from '../logic/state.svelte.ts';
import { roundDialog } from '../views/misc.ts';
import type { ClientFeature } from './contract.ts';

const field = (s: RoundSetting): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(`#${roundFieldId(s)}`);

/**
 * A number field as a number; an empty one as no number, which the request
 * sends as null, so the server refuses it also where 0 is allowed (#228).
 */
const numberOf = (raw: string | undefined): number =>
  raw ? Number(raw) : Number.NaN;

/** The values of the open dialog: a checkbox yes or no, a field as a number. */
const dialogValues = (): Record<string, number | boolean> =>
  Object.fromEntries(
    ROUND_SETTINGS.map((s) => [
      s.name,
      s.kind === 'switch' ? !!field(s)?.checked : numberOf(field(s)?.value),
    ]),
  );

/** The data-act handlers of „Neue Runde“. */
export const clientFeature = {
  acts: ({ act, modal }) => ({
    reset: () => modal(roundDialog(client.game!.round)),
    doReset: () => {
      // Read before the dialog closes with its fields.
      const data = roundRequest(dialogValues());
      modal('');
      return act('reset', data);
    },
  }),
} satisfies ClientFeature;
