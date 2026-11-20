import { mount, unmount } from 'svelte';
import { galaxyPage } from '../logic/galaxy.ts';
import type { V } from './common.ts';
import Galaxy from './Galaxy.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';

/**
 * The Sternenkarte (#118, bundle 2), its data as a property. It is mounted
 * anew on every render, as the HTML view was rendered anew: the fields
 * „Galaxie“ and „System“ show the shown system, the focus returns by id
 * (main.ts), and the clock counts the countdowns of the scan down.
 */
function mountGalaxy(target: HTMLElement, v: V) {
  const component = mount(Galaxy, { target, props: { page: galaxyPage(v) } });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'galaxy',
    mount: mountGalaxy,
    anew: true,
    menu: { order: 90, label: 'Sternenkarte' },
    glyph: glyph(
      '<path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 15l-5 3.2 1.4-5.6L4 8.8l5.8-.5z"/>',
    ),
    tab: { order: 40 },
  },
] satisfies readonly ClientView[];
