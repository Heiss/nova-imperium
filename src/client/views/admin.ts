import { flushSync, mount, unmount } from 'svelte';
import {
  adminPage,
  endzeitDialogPage,
  roundDialogPage,
} from '../logic/admin.ts';
import type { Dialog } from '../modal.ts';
import type { V } from './common.ts';
import Admin from './Admin.svelte';
import { attachAdminPanel } from './admin-panel.ts';
import EndzeitDialog from './EndzeitDialog.svelte';
import RoundDialog from './RoundDialog.svelte';

/**
 * „Admin“ (#118, bundle 7), its data as a property. It is mounted anew on
 * every render, as the HTML view was rendered anew; the panels that fill
 * themselves are put into the new page at once (views/admin-panel.ts), before
 * `keepInputs` of main.ts puts back what was typed.
 */
export function mountAdmin(target: HTMLElement, v: V) {
  const page = adminPage(v);
  const component = mount(Admin, { target, props: { page } });
  flushSync();
  if (page) attachAdminPanel(target, v);
  return { destroy: () => void unmount(component) };
}

/** The dialog „Neue Runde“ as a component of the modal (#283). */
export const roundDialog =
  (...args: Parameters<typeof roundDialogPage>): Dialog =>
  (target) => {
    const component = mount(RoundDialog, {
      target,
      props: { page: roundDialogPage(...args) },
    });
    return () => void unmount(component);
  };

/** The confirmation of the „Endzeit“ with its flight time (#161). */
export const endzeitDialog =
  (minutes: number): Dialog =>
  (target) => {
    const component = mount(EndzeitDialog, {
      target,
      props: { page: endzeitDialogPage(minutes) },
    });
    return () => void unmount(component);
  };
