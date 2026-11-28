// Where the guild chat is shown (#496): the page of the guild (#169), the
// tab „Gilde“ of „Nachrichten“ and the chat window. Each place has its own
// ids, so two of them can be in the page at once; the page of the guild keeps
// the ids it had, which the handlers and the tests read. The window keeps its
// own draft: it stays over a change of the view, a view drops its drafts.
import type { DraftField } from './drafts.svelte.ts';

export type ChatPlace = 'guild' | 'messages' | 'window';

/** The id of the form of the guild chat, and the prefix of every other place. */
export const CHAT_FORM = 'guildchatform';
const CHAT_FIELD = 'chat_text';

/** The ids of the form and of its text field at `place`. */
export const chatIds = (place: ChatPlace): { form: string; field: string } =>
  place === 'guild'
    ? { form: CHAT_FORM, field: CHAT_FIELD }
    : { form: `${CHAT_FORM}-${place}`, field: `${CHAT_FIELD}-${place}` };

/** The draft of the text at `place`. */
export const chatDraft = (place: ChatPlace): DraftField =>
  place === 'window' ? 'windowChat' : 'guildChat';

/** The place of a form by its id, or null for a form that is no guild chat. */
export function chatPlaceOf(id: string): ChatPlace | null {
  if (id === CHAT_FORM) return 'guild';
  for (const place of ['messages', 'window'] as const)
    if (id === chatIds(place).form) return place;
  return null;
}
