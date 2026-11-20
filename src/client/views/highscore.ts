import { mount, unmount } from 'svelte';
import { highscorePage } from '../logic/highscore.ts';
import type { V } from './common.ts';
import Highscore from './Highscore.svelte';
import type { ClientView } from './contract.ts';

/**
 * „Highscore“ (#118, bundle 5), its data as a property. It is mounted anew
 * on every render, as the HTML view was rendered anew: the buttons set the
 * category in `client.ui.highscore` (features/highscore.ts) and render again.
 */
function mountHighscore(target: HTMLElement, v: V) {
  const component = mount(Highscore, {
    target,
    props: { page: highscorePage(v) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'highscore',
    mount: mountHighscore,
    anew: true,
    menu: { order: 110, label: 'Highscore' },
  },
] satisfies readonly ClientView[];
