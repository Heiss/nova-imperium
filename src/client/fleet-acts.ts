// The data-act handlers of the ship selection and the cargo of the fleet
// view and of the Warp-Tor (#230), out of main.ts (ratchet #242): „alle
// Schiffe“ and „keine Schiffe“ fill the selection, „alles“ fills the cargo
// (#240), „Springen“ jumps the picked ships to the „Zielmond“. The markup is
// in views/fleet.ts, the box of the Warp-Tor from logic/jump-gate.ts.
import type { Planet, Resources } from '../core/types.ts';
import { CARGO, cargoMax, cargoOne, type FleetForm } from './logic/game.ts';
import { client } from './logic/state.svelte.ts';

/** What the handlers need from main.ts. */
interface Deps {
  /** Sends an action; true when it went through on the place still shown. */
  actHere: (type: string, data?: object) => Promise<boolean>;
  /** Updates the preview of the fleet form. */
  calc: () => void;
  /** The fleet form as it is filled in. */
  form: () => FleetForm;
  /** The shown planet with its stock of this moment. */
  planet: () => Planet;
  /** Sets the value of an input, when it is there. */
  setInput: (sel: string, v: string | number) => void;
  render: (fresh?: boolean) => void;
}

const shipInputs = () => document.querySelectorAll<HTMLInputElement>('.fs');

/** The data-act handlers of the ship selection, the cargo and „Springen“. */
export function fleetActs({
  actHere,
  calc,
  form,
  planet,
  setInput,
  render,
}: Deps): Record<string, (d: Record<string, string | undefined>) => unknown> {
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
  };
}
