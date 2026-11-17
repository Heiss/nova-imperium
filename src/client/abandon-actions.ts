// The browser side of „Kolonie aufgeben“ (#224) and of the dialog „Neue
// Runde“ with its locks, out of main.ts (ratchet #242): the button opens the
// confirmation, its form sends the planet it was opened for, with its
// founding time, and the password and closes on success. The markup is in logic/abandon.ts and
// views/misc.ts.
import { abandonDialog } from './logic/abandon.ts';
import { client } from './logic/state.svelte.ts';
import { roundDialog } from './views/misc.ts';

/** What the actions need from main.ts. */
interface Deps {
  act: (type: string, data?: object) => Promise<boolean>;
  modal: (html: string) => void;
}

const value = (sel: string): string =>
  document.querySelector<HTMLInputElement>(sel)?.value ?? '';

/** The locks of the dialog „Neue Runde“: the main planet (#221) and a given-up position (#224). */
export const roundLocks = (): { mainLock: number; abandonLock: number } => ({
  mainLock: Number(value('#round-main-lock')),
  abandonLock: Number(value('#round-abandon-lock')),
});

/** The data-act handlers of „Kolonie aufgeben“ and „Neue Runde“; the form of the first is handled here too. */
export function abandonActs({ act, modal }: Deps): Record<string, () => void> {
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
  return {
    abandon: () => modal(abandonDialog(client.view!.P, client.game!)),
    reset: () => modal(roundDialog(client.game!.round)),
  };
}
