import { mount, unmount } from 'svelte';
import Overview from './Overview.svelte';

/**
 * The overview (#118); it shows `client.shown` of the state module. It is
 * mounted anew on every render, as the HTML view rendered anew, so the
 * clock of main.ts counts its countdowns down as before.
 */
export function mountOverview(target: HTMLElement) {
  const component = mount(Overview, { target });
  return { destroy: () => void unmount(component) };
}
