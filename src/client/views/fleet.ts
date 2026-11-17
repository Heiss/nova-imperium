import { flushSync, mount, unmount } from 'svelte';
import { fleetPage, missionChoice, targetSite } from '../logic/fleet.ts';
import type { FleetForm } from '../logic/game.ts';
import type { GameState } from '../logic/types.ts';
import type { V } from './common.ts';
import Fleet from './Fleet.svelte';

/** The mounted fleet view. */
let shown: ReturnType<typeof mountFleet>['component'] | undefined;

/**
 * The fleet view (#118, bundle 3), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew: main.ts keeps
 * the typed values and the focus by id, and fills the target and the
 * preview of the flight.
 */
export function mountFleet(target: HTMLElement, v: V) {
  const component = mount(Fleet, { target, props: { page: fleetPage(v) } });
  shown = component;
  return {
    component,
    destroy: () => {
      shown = undefined;
      void unmount(component);
    },
  };
}

/**
 * Aims the list „Auftrag“ at the target of the form (#253): it shows only
 * the missions that fit what is there, and switches to the first of them
 * when the chosen one no longer fits. Returns the form with the mission the
 * list now shows.
 */
export function aimFleet(s: GameState, f: FleetForm): FleetForm {
  const choice = missionChoice(s.me.id, targetSite(s, f.to), f.mission);
  shown?.aim(choice);
  flushSync();
  const select = document.querySelector<HTMLSelectElement>('#t_m');
  if (select) select.value = choice.mission;
  return { ...f, mission: choice.mission };
}
