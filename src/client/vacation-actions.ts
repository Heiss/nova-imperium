// The browser side of the vacation mode (#223), out of main.ts (ratchet
// #242): „Urlaubsmodus aktivieren“ asks first, since it cannot end before
// the minimum duration; „Urlaubsmodus beenden“ sends the end. The markup is
// in logic/vacation.ts; the minimum duration in the dialog „Neue Runde“ is
// an entry of the registry of the round settings (core/vacation.ts).
import { confirmText } from './logic/vacation.ts';
import { client } from './logic/state.svelte.ts';

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
}

/** The data-act handlers of the vacation mode. */
export const vacationActs = ({ act }: Deps) => ({
  startVacation: () =>
    window.confirm(confirmText(client.game!.round.vacationHours)) &&
    act('startVacation'),
  endVacation: () => act('endVacation'),
});
