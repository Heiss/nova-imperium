import { mount, unmount } from 'svelte';
import { messagesPage } from '../logic/messages.ts';
import type { V } from './common.ts';
import Messages from './Messages.svelte';

/**
 * „Nachrichten“ (#118, bundle 4), its data as a property. It is mounted anew
 * on every render, as the HTML view was rendered anew: a report the player
 * opened stays open (`client.ui.openRep`), and the focus returns by id.
 */
export function mountMessages(target: HTMLElement, v: V) {
  const component = mount(Messages, {
    target,
    props: { page: messagesPage(v) },
  });
  return { destroy: () => void unmount(component) };
}
