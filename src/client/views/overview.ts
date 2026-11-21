import { mount, unmount } from 'svelte';
import Overview from './Overview.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';

/**
 * The overview (#118); it shows `client.shown` of the state module. It is
 * mounted anew on every render, as the HTML view rendered anew, so the
 * clock of main.ts counts its countdowns down as before.
 */
function mountOverview(target: HTMLElement) {
  const component = mount(Overview, { target });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'overview',
    mount: mountOverview,
    anew: true,
    menu: { order: 10, label: 'Übersicht' },
    glyph: glyph(
      '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="3.6" transform="rotate(-20 12 12)"/>',
    ),
    tab: { order: 10 },
  },
] satisfies readonly ClientView[];
