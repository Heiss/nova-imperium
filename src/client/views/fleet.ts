import { mount, unmount } from 'svelte';
import { fleetPage } from '../logic/fleet.ts';
import type { V } from './common.ts';
import Fleet from './Fleet.svelte';

/**
 * The fleet view (#118, bundle 3), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew: main.ts keeps
 * the typed values and the focus by id, and fills the target and the
 * preview of the flight.
 */
export function mountFleet(target: HTMLElement, v: V) {
  const component = mount(Fleet, { target, props: { page: fleetPage(v) } });
  return { destroy: () => void unmount(component) };
}
