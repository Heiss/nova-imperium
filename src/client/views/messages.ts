import { mount, unmount } from 'svelte';
import { messagesPage } from '../logic/messages.ts';
import type { V } from './common.ts';
import Messages from './Messages.svelte';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';

/**
 * „Nachrichten“ (#118, bundle 4), its data as a property. It is mounted anew
 * on every render, as the HTML view was rendered anew: a report the player
 * opened stays open (`client.ui.openRep`), and the focus returns by id.
 */
function mountMessages(target: HTMLElement, v: V) {
  const component = mount(Messages, {
    target,
    props: { page: messagesPage(v) },
  });
  return { destroy: () => void unmount(component) };
}

export const clientViews = [
  {
    key: 'messages',
    mount: mountMessages,
    anew: true,
    menu: { order: 100, label: 'Nachrichten' },
    glyph: glyph(
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    ),
  },
] satisfies readonly ClientView[];
