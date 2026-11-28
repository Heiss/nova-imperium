// Where the guild chat is in sight right now (#496): the tab „Gilde“ of
// „Nachrichten“ while it is the shown tab, and the chat window while it is open
// on „Gilde“. A member who sees the chat there has seen it, as on the page of
// its guild (#169): features/reading.ts sends the visit. The page of the guild
// is read from the view and the address, not from here.
import type { ChatPlace } from './chat-place.ts';

const shown = new Set<ChatPlace>();
let seen: () => void = () => {};

/** `place` shows the guild chat now (`on`), or no more; a place that comes into sight is a visit. */
export function showGuildChat(place: ChatPlace, on: boolean): void {
  if (on === shown.has(place)) return;
  if (on) shown.add(place);
  else shown.delete(place);
  if (on) seen();
}

/** Whether a place other than the page of the guild shows the chat. */
export const guildChatShown = (): boolean => shown.size > 0;

/** What to do when a place comes into sight: the visit of features/reading.ts. */
export function onGuildChatShown(visit: () => void): void {
  seen = visit;
}
