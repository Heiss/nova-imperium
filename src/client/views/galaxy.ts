import { mount, unmount } from 'svelte';
import { galaxyPage } from '../logic/galaxy.ts';
import type { V } from './common.ts';
import Galaxy from './Galaxy.svelte';

/**
 * The Sternenkarte (#118, bundle 2), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew: the fields
 * „Galaxie“ and „System“ show the shown system, the focus returns by id
 * (main.ts), and the clock counts the countdowns of the scan down.
 */
export function mountGalaxy(target: HTMLElement, v: V) {
  const component = mount(Galaxy, { target, props: { page: galaxyPage(v) } });
  return { destroy: () => void unmount(component) };
}
