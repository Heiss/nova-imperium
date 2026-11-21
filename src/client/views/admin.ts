import { flushSync, mount, unmount } from 'svelte';
import {
  adminPage,
  endzeitDialogPage,
  roundDialogPage,
} from '../logic/admin.ts';
import { enterAdminPanels } from '../logic/admin-panels.svelte.ts';
import type { Dialog } from '../modal.ts';
import type { V } from './common.ts';
import type { ClientView } from './contract.ts';
import Admin from './Admin.svelte';
import EndzeitDialog from './EndzeitDialog.svelte';
import RoundDialog from './RoundDialog.svelte';

/**
 * „Admin“ (#118, bundle 7), its data as a property. It is mounted anew on
 * every render, as the HTML view was rendered anew; the panels that fill
 * themselves keep what they loaded and what was typed over it
 * (logic/admin-panels.svelte.ts), and start for an admin they were not shown
 * to before.
 */
function mountAdmin(target: HTMLElement, v: V) {
  const page = adminPage(v);
  if (page) enterAdminPanels(v.s.me.id, Date.now());
  const component = mount(Admin, { target, props: { page } });
  flushSync();
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

/** The page „Admin“, mounted anew on every render; its entry stands last in the menu and is shown to an admin only. */
export const clientViews = [
  {
    key: 'admin',
    mount: mountAdmin,
    anew: true,
    menu: { order: 180, label: 'Admin', show: (_, admin) => admin },
  },
] satisfies readonly ClientView[];
