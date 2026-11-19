// The data-act handlers of the ship selection and the cargo of the fleet
// view and of the Warp-Tor (#230), out of main.ts (ratchet #242): „alle
// Schiffe“ and „keine Schiffe“ fill the selection, „alles“ fills the cargo
// (#240), „Springen“ jumps the picked ships to the „Zielmond“. The markup is
// in views/fleet.ts, the box of the Warp-Tor from logic/jump-gate.ts.
import type { Resources } from '../../core/types.ts';
import { CARGO, cargoMax, cargoOne } from '../logic/game.ts';
import { client } from '../logic/state.svelte.ts';
import type { ClientFeature } from './contract.ts';

const shipInputs = () => document.querySelectorAll<HTMLInputElement>('.fs');

/** The data-act handlers of the ship selection, the cargo and „Springen“. */
export const clientFeature = {
  acts: ({ actHere, setInput, render, fleet: { calc, form, planet } }) => ({
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
    cmax: () => {
      const c = cargoMax(planet(), form());
      for (const k of CARGO) setInput(`#c_${k}`, c[k]);
      calc();
    },
    cone: (d) => {
      const k = d.k as keyof Resources;
      setInput(`#c_${k}`, cargoOne(planet(), form(), k));
      calc();
    },
    jump: async () => {
      const to = document.querySelector<HTMLSelectElement>('#jg_to')?.value;
      if (await actHere('jump', { to, ships: form().ships })) render(true);
    },
  }),
} satisfies ClientFeature;
