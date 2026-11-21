import { mount, unmount } from 'svelte';
import { authPage } from '../logic/auth.ts';
import type { Ui } from './common.ts';
import Auth from './Auth.svelte';

/**
 * The login, the registration or one of the steps after them (#118, bundle 7),
 * mounted into the page while nobody is signed in. It is mounted anew on every
 * render, as its HTML was rendered anew; main.ts reads the fields by their ids.
 */
export function mountAuth(target: HTMLElement, ui: Ui) {
  const component = mount(Auth, { target, props: { page: authPage(ui) } });
  return { destroy: () => void unmount(component) };
}
