// The guild chat (#169): its limits and the pure rules of a message. Shared
// by the server, which checks every message, and the guild view, which
// shows only what the own rank may do. See okf/features/guild-chat.md.
import { isBelow, type RankRule } from './guild-ranks.ts';

/** Longest message in characters, plain text (issue #169, kept by the owner). */
export const MAX_CHAT_TEXT = 1000;
/** Messages each guild keeps, events included (owner, 2026-11-14, D6). */
export const CHAT_HISTORY = 500;
/** One message per member in this many milliseconds (the example of issue #169: 1 per 2 s). */
export const CHAT_INTERVAL = 2000;

/** How a message counts: by characters (code points), as SQLite's length(). */
export const chatLength = (text: string): number => [...text].length;

/** A message of 1 to MAX_CHAT_TEXT characters; the text is cleaned already. */
export function chatTextError(text: string): 'empty' | 'length' | null {
  if (!text) return 'empty';
  return chatLength(text) > MAX_CHAT_TEXT ? 'length' : null;
}

/**
 * Whether `actor` may delete a message (#169 D2 and the order of #163 D4):
 * it needs the right „Chatnachrichten löschen“, and the author stands below
 * it, as for every action on a member, or is the actor itself. A former
 * member and a deleted account have no rank and stand lowest (`Infinity`).
 */
export function canDeleteChat(
  actor: RankRule,
  own: boolean,
  author: number,
): boolean {
  return (
    actor.rights.includes('chat-delete') &&
    (own || isBelow(actor.position, author))
  );
}
