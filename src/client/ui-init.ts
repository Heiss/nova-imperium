// The interface state of this device before the first render (formerly in
// main.ts): the view and its parameters of the address, the animations and the
// news this device has seen.
import { ANIMATION_KEY, animationsOn } from './logic/planet.ts';
import { client } from './logic/state.svelte.ts';
import { readNewsSeen } from './news-seen.ts';
import { paramsFromUrl, viewFromUrl } from './view-address.ts';

export function initUi(): void {
  const view = viewFromUrl();
  Object.assign(client.ui, {
    view,
    // The parameters the view declares (#379).
    params: paramsFromUrl(view),
    animations: animationsOn(() => localStorage.getItem(ANIMATION_KEY)),
    newsSeen: readNewsSeen(),
  });
  document.documentElement.classList.toggle('no-anim', !client.ui.animations);
}
