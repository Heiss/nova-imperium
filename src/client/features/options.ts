// The browser side of „Hilfe & Optionen“, out of main.ts (ratchet #242): the
// options, the choice of the main planet (#221) and the vacation mode
// (#223). „Urlaubsmodus aktivieren“ asks first, since it cannot end before
// the minimum duration; „Urlaubsmodus beenden“ sends the end. The markup of
// the vacation box is in logic/vacation.ts; the minimum duration in the
// dialog „Neue Runde“ is an entry of the registry of the round settings
// (core/vacation.ts).
import { clampInt } from '../logic/format.ts';
import { client } from '../logic/state.svelte.ts';
import { confirmText } from '../logic/vacation.ts';
import type { ClientFeature } from './contract.ts';

const value = (sel: string): string =>
  document.querySelector<HTMLInputElement>(sel)?.value ?? '';

/** The data-act handlers of the boxes of „Hilfe & Optionen“. */
export const clientFeature = {
  acts: ({ act }) => ({
    saveopt: () =>
      act('options', {
        probes: clampInt(value('#o_probes'), 1, 1e6),
        explain: value('#o_explain'),
      }),
    mainPlanet: () => act('mainPlanet', { main: value('#o_main') }),
    startVacation: () =>
      window.confirm(confirmText(client.game!.round.vacationHours)) &&
      act('startVacation'),
    endVacation: () => act('endVacation'),
  }),
} satisfies ClientFeature;
