import { messagesHint } from '../logic/menu-hints.ts';
import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import type { V } from './common.ts';
import type { ClientView } from './contract.ts';
import { glyph } from './glyph.ts';
import MessagesTabs from './MessagesTabs.svelte';

/**
 * „Nachrichten“ (#118, bundle 4; tabs #226), mounted once and kept up to
 * date with the view state: the tab, the open conversation and what the
 * player typed into the forms of „Posteingang“ stay over a render. A report
 * the player opened stays open (`client.ui.openRep`), as before.
 */
function mountMessages(target: HTMLElement, initial: V) {
  const viewState = writable(initial);
  const component = mount(MessagesTabs, { target, props: { viewState } });
  return {
    update: viewState.set,
    destroy: () => void unmount(component),
  };
}

export const clientViews = [
  {
    key: 'messages',
    hint: { mark: ({ unread }) => messagesHint(unread) },
    mount: mountMessages,
    menu: { order: 100, label: 'Nachrichten' },
    glyph: glyph(
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/>',
    ),
  },
] satisfies readonly ClientView[];
