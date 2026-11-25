import { mount, unmount } from 'svelte';
import {
  adminPage,
  endzeitDialogPage,
  roundDialogPage,
} from '../logic/admin.ts';
import { enterAdminPanels } from '../logic/admin-panels.svelte.ts';
import type { Dialog } from '../modal.ts';
import type { V } from './common.ts';
import type { ClientView } from './contract.ts';
import { keptMount } from './kept.ts';
import Admin from './Admin.svelte';
import EndzeitDialog from './EndzeitDialog.svelte';
import RoundDialog from './RoundDialog.svelte';

/**
 * „Admin“ (#118, bundle 7), its data as a property. A fresh render mounts it
 * anew; any other render hands it the new page, so the fields of its tabs
 * stay the same elements while the admin types (#361). The panels that fill
 * themselves keep what they loaded and what was typed over it
 * (logic/admin-panels.svelte.ts), and start for an admin they were not shown
 * to before.
 */
const mountAdmin = keptMount(Admin, (v: V) => {
  const page = adminPage(v);
  if (page) enterAdminPanels(v.s.me.id, Date.now());
  return page;
});

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

/** The page „Admin“, kept over a render that is not fresh; its entry stands last in the menu and is shown to an admin only. */
export const clientViews = [
  {
    key: 'admin',
    mount: mountAdmin,
    fresh: true,
    offered: (_, admin) => admin,
    menu: { order: 180, label: 'Admin' },
  },
] satisfies readonly ClientView[];
