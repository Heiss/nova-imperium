// The place of the chat window (#496): `#chatwin` of index.html, outside the
// view, so the window stays over a change of the view. ChatWindow.svelte is
// mounted once per player and follows the state, as „Nachrichten“ does, so
// the open conversation and what is typed stay over the poll. No window: the
// place is empty (signed out, the lock screen of the vacation mode (Q4 [V]),
// the switch off, the view „Nachrichten“).
import { mount, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import type { ChatWindowPage } from '../logic/chat-window.ts';
import ChatWindow from './ChatWindow.svelte';

type Shown = { page: ChatWindowPage; uid: string };

let shown: {
  uid: string;
  state: Writable<Shown>;
  component: ReturnType<typeof mount>;
} | null = null;

/** Shows the window `page` for the player `uid`, or none. */
export function showChatWindow(page: ChatWindowPage | null, uid = ''): void {
  if (page && shown?.uid === uid) return shown.state.set({ page, uid });
  if (shown) void unmount(shown.component);
  shown = null;
  const target = document.getElementById('chatwin');
  if (!target) return;
  target.replaceChildren();
  if (!page) return;
  const state = writable({ page, uid });
  shown = {
    uid,
    state,
    component: mount(ChatWindow, { target, props: { viewState: state } }),
  };
}
