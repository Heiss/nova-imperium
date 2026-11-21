import { mount, unmount } from 'svelte';
import { fleetPage } from '../logic/fleet.ts';
import type { V } from './common.ts';
import Fleet from './Fleet.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';

/**
 * The fleet view (#118, bundle 3), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew: main.ts keeps
 * the typed values and the focus by id, and the fleet form fills the target
 * and the preview of the flight (features/fleet.ts).
 */
function mountFleet(target: HTMLElement, v: V) {
  const component = mount(Fleet, { target, props: { page: fleetPage(v) } });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'fleet',
    mount: mountFleet,
    anew: true,
    menu: { order: 80, label: 'Flotte', divider: true },
    glyph: glyph(
      '<path d="M3 12l7-3 11 3-11 3z"/><path d="M8 9.8L6 5l5 3.5M8 14.2L6 19l5-3.5"/>',
    ),
    tab: { order: 30 },
  },
] satisfies readonly ClientView[];
