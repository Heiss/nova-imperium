import { mount, unmount } from 'svelte';
import { optionsPage } from '../logic/options.ts';
import type { V } from './common.ts';
import Options from './Options.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Optionen“ (#118, bundle 5), its data as a property. It is mounted anew on
 * every render, as the HTML view was rendered anew: the inputs are kept over
 * a render by their ids (main.ts), and the features that fill the box of the
 * play time and show the button of the installation do so after each render
 * (afterRender of features/playtime.ts and features/install.ts).
 */
function mountOptions(target: HTMLElement, v: V) {
  const component = mount(Options, {
    target,
    props: { page: optionsPage(v) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'help',
    mount: mountOptions,
    anew: true,
    menu: { order: 170, label: 'Optionen' },
  },
] satisfies readonly ClientView[];
