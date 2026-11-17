// The data-act handlers of the ship selection of the fleet view and of the
// Warp-Tor (#230), out of main.ts (ratchet #242): „alle Schiffe“ and „keine
// Schiffe“ fill the selection, „Springen“ jumps the picked ships to the
// „Zielmond“. The markup is in views/fleet.ts, the box of the Warp-Tor from
// logic/jump-gate.ts.
import type { Levels } from '../core/types.ts';
import { client } from './logic/state.svelte.ts';

/** What the handlers need from main.ts. */
interface Deps {
  /** Sends an action; true when it went through on the place still shown. */
  actHere: (type: string, data?: object) => Promise<boolean>;
  /** Updates the preview of the fleet form. */
  calc: () => void;
  /** The ships picked in the fleet form. */
  ships: () => Levels;
  render: (fresh?: boolean) => void;
}

const shipInputs = () => document.querySelectorAll<HTMLInputElement>('.fs');

/** The data-act handlers of the ship selection and of „Springen“. */
export function fleetActs({
  actHere,
  calc,
  ships,
  render,
}: Deps): Record<string, () => unknown> {
  return {
    fall: () => {
      shipInputs().forEach(
        (i) => (i.value = String(client.view!.P.ships[i.dataset.k!] ?? 0)),
      );
      calc();
    },
    fnone: () => {
      shipInputs().forEach((i) => (i.value = ''));
      calc();
    },
    jump: async () => {
      const to = document.querySelector<HTMLSelectElement>('#jg_to')?.value;
      if (await actHere('jump', { to, ships: ships() })) render(true);
    },
  };
}
