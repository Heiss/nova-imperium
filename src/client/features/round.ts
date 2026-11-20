// The browser side of the dialog „Neue Runde“ (#283), out of main.ts
// (ratchet #242): it shows one field per setting of the registry
// `ROUND_SETTINGS` and sends what the admin chose. A feature with a value
// per round adds its registry entry and changes nothing here.
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundFieldId,
  roundConfirm,
  roundPreview,
  roundRequest,
  roundShown,
} from '../../core/round.ts';
import { client } from '../logic/state.svelte.ts';
import { roundDialog } from '../views/admin.ts';
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
const dialogValues = (
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): Record<string, number | boolean> =>
  Object.fromEntries(
    settings.map((s) => [
      s.name,
      s.kind === 'switch' ? !!field(s)?.checked : numberOf(field(s)?.value),
    ]),
  );

/**
 * Brings the open dialog in line with its fields (#237): an entry that is
 * shown only while another field has a value is hidden or shown, and the
 * preview line of a group is written again. A hidden field keeps its value.
 */
export function syncRoundDialog(
  settings: readonly RoundSetting[] = ROUND_SETTINGS,
): void {
  const values = dialogValues(settings);
  for (const s of settings) {
    const wrap = document.querySelector<HTMLElement>(
      `[data-round-field="${roundFieldId(s)}"]`,
    );
    if (wrap) wrap.hidden = !roundShown(s, values);
    const group = s.group;
    const line = group
      ? document.querySelector<HTMLElement>(`#round-preview-${group.name}`)
      : null;
    if (group && line) line.textContent = roundPreview(group, values, settings);
    const sure = group
      ? document.querySelector<HTMLElement>(`#round-confirm-${group.name}`)
      : null;
    if (group && sure) sure.textContent = roundConfirm(group, values, settings);
  }
}

/** The data-act handlers of „Neue Runde“. */
export const clientFeature = {
  acts: ({ act, modal }) => {
    const changed = (e: Event): void => {
      if ((e.target as HTMLElement | null)?.id?.startsWith('round-'))
        syncRoundDialog();
    };
    document.addEventListener('change', changed);
    document.addEventListener('input', changed);
    return {
      reset: () =>
        modal(
          roundDialog(
            client.game!.round,
            ROUND_SETTINGS,
            client.game!.admin?.fresh,
          ),
        ),
      doReset: () => {
        // Read before the dialog closes with its fields.
        const data = roundRequest(dialogValues());
        modal('');
        return act('reset', data);
      },
    };
  },
} satisfies ClientFeature;
