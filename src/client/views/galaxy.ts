import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { galaxyPage } from '../logic/galaxy.ts';
import type { V } from './common.ts';
import type { ClientView } from './contract.ts';
import GalaxyView from './GalaxyView.svelte';
import { glyph } from './glyph.ts';

/**
 * The Sternenkarte (#118, bundle 2), its data as a property. A fresh render
 * (another system, a step, the moon, the scan, the sheet of a phone) mounts it
 * anew and drops the typed position; any other render (the poll, the clock,
 * the news) hands it the new page, so the fields „Galaxie“ and „System“ stay
 * the same elements and keep what is selected and where the caret is (#352).
 * The focus returns by id (render.ts), and the clock counts the countdowns
 * of the scan down.
 */
function mountGalaxy(target: HTMLElement, v: V) {
  const page = writable(galaxyPage(v));
  const component = mount(GalaxyView, { target, props: { page } });
  return {
    update: (next: V) => page.set(galaxyPage(next)),
    destroy: () => void unmount(component),
  };
}

export const clientViews = [
  {
    key: 'galaxy',
    mount: mountGalaxy,
    fresh: true,
    menu: { order: 90, label: 'Sternenkarte' },
    glyph: glyph(
      '<path d="M12 3l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 15l-5 3.2 1.4-5.6L4 8.8l5.8-.5z"/>',
    ),
    tab: { order: 40 },
  },
] satisfies readonly ClientView[];
