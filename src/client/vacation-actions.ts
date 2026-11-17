// The browser side of the vacation mode (#223) and of the dialog „Neue
// Runde“ with its values, out of main.ts (ratchet #242): „Urlaubsmodus
// aktivieren“ asks first, since it cannot end before the minimum duration;
// „Urlaubsmodus beenden“ sends the end. The markup is in logic/vacation.ts
// and views/misc.ts.
import { confirmText } from './logic/vacation.ts';
import { client } from './logic/state.svelte.ts';
import { roundDialog } from './views/misc.ts';

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
}

const input = (sel: string): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>(sel);

/** The choices of the dialog „Neue Runde“: rewards, guilds (#191), the lock of the main planet (#221) and the minimum duration of the vacation mode (#223). */
const roundChoices = () => ({
  rewards: {
    achievements: !!input('#round-achievements')?.checked,
    daily: !!input('#round-daily')?.checked,
  },
  guilds: !!input('#round-guilds')?.checked,
  mainLock: Number(input('#round-main-lock')?.value),
  vacationHours: Number(input('#round-vacation-hours')?.value),
});

/** The data-act handlers of the vacation mode and of „Neue Runde“. */
export function vacationActs({
  act,
  modal,
}: Deps): Record<string, () => unknown> {
  return {
    startVacation: () =>
      window.confirm(confirmText(client.game!.round.vacationHours)) &&
      act('startVacation'),
    endVacation: () => act('endVacation'),
    reset: () => modal(roundDialog(client.game!.round)),
    doReset: () => {
      const choices = roundChoices();
      modal('');
      return act('reset', choices);
    },
  };
}
