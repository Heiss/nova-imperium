import { mount, unmount } from 'svelte';
import type { Dialog } from '../modal.ts';
import DeleteAccountDialog from './DeleteAccountDialog.svelte';

/** The confirmation of „Account löschen“ with the password, as a component of the modal. */
export const deleteAccountDialog =
  (text: string, confirm: (password: string) => Promise<boolean>): Dialog =>
  (target) => {
    const component = mount(DeleteAccountDialog, {
      target,
      props: { text, confirm },
    });
    return () => void unmount(component);
  };
