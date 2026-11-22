import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { optionsPage } from '../logic/options.ts';
import type { V } from './common.ts';
import type { ClientView } from './contract.ts';
import OptionsView from './OptionsView.svelte';

/**
 * „Optionen“ (#118, bundle 5), its data as a property. A fresh render
 * (another view) mounts it anew; any other render (the poll, the clock, the
 * news, the save of a switch) hands it the new page, so the page keeps its
 * elements and neither the scroll position nor a switch moves under the
 * player's finger (#355). The fields keep their values as the state of the
 * forms (logic/options-form.svelte.ts). The features that fill the box of the
 * play time and show the button of the installation do so after each render
 * (afterRender of features/playtime.ts and features/install.ts) into the same
 * elements; the list of the passkeys stays until a fresh render.
 */
function mountOptions(target: HTMLElement, v: V) {
  const page = writable(optionsPage(v));
  const component = mount(OptionsView, { target, props: { page } });
  return {
    update: (next: V) => page.set(optionsPage(next)),
    destroy: () => void unmount(component),
  };
}

export const clientViews = [
  {
    key: 'help',
    mount: mountOptions,
    fresh: true,
    menu: { order: 170, label: 'Optionen' },
  },
] satisfies readonly ClientView[];
