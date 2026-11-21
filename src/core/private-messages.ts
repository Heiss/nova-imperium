// Private messages between players (#226): the pure rules. Shared by the
// server, which checks every message, and the browser, which words the
// refusals and counts what is unread. See okf/features/private-messages.md.
import {
  CHAT_HISTORY,
  CHAT_INTERVAL,
  chatTextError,
  MAX_CHAT_TEXT,
} from './guild-chat.ts';

/** Longest message in characters: the one of the guild chat (owner, 2026-11-21). */
export const MAX_PM_TEXT = MAX_CHAT_TEXT;
/** Messages kept per conversation between two players (owner, 2026-11-21). */
export const PM_HISTORY = CHAT_HISTORY;
/**
 * The size of a page of a conversation or of the sent messages, as an action
 * loads it: a technical page size, not a rule of the owner [V] (coordinator,
 * 2026-11-21, Q27, Q32, Q33). The state carries only the newest message of a
 * conversation; the 500 kept per conversation stay `PM_HISTORY`.
 */
export const PM_PAGE = 50;
/** One message per sender in this many milliseconds (owner, 2026-11-21: 1 per 2 s). */
export const PM_INTERVAL = CHAT_INTERVAL;

/**
 * Why a message is refused. `refused` is the one code for both „the
 * recipient blocked the sender“ and „the recipient takes messages from
 * friends only“: the sender never learns which one it was (owner,
 * 2026-11-21).
 */
export type PmError =
  'unknown' | 'self' | 'empty' | 'length' | 'rate' | 'refused';

/** The text of the refusal of the code `refused`. */
// [V] pending owner decision: the draft of the text a blocked sender sees.
export const REFUSED_TEXT =
  'Dieser Spieler nimmt keine Nachrichten von dir an.';

/** The German message of each code; `empty`, `length` and `rate` are the words of the guild chat. */
export const PM_ERROR_TEXT: Readonly<Record<PmError, string>> = {
  unknown: 'Spieler nicht gefunden.',
  // [V] the wording; the owner decided no text for writing to oneself.
  self: 'Du kannst dir nicht selbst schreiben.',
  empty: 'Die Nachricht ist leer.',
  length: 'Die Nachricht darf höchstens 1.000 Zeichen haben.',
  rate: 'Bitte warte kurz vor der nächsten Nachricht.',
  refused: REFUSED_TEXT,
};

/** A cleaned text: 1 to MAX_PM_TEXT characters, else the code. */
export const pmTextError = (text: string): 'empty' | 'length' | null =>
  chatTextError(text);

/** Whether a sender whose last message was at `last` (none: undefined) must wait at `now`. */
export const pmTooSoon = (now: number, last: number | undefined): boolean =>
  now - (last ?? -Infinity) < PM_INTERVAL;

/** What the server knows about one attempt to send. */
export interface SendFacts {
  sender: string;
  /** The recipient, null when no such player exists. */
  recipient: string | null;
  /** The recipient has the sender on its block list. */
  blocked: boolean;
  /** The recipient takes messages from friends only. */
  friendsOnly: boolean;
  /** The two are friends. */
  friends: boolean;
}

/**
 * Whether the message may go to the recipient: any player may write to any
 * player, except a blocked one, and except a non-friend when the recipient
 * takes messages from friends only (owner, 2026-11-21). Both refusals give
 * the same code.
 */
export function sendError(f: SendFacts): PmError | null {
  if (f.recipient === null) return 'unknown';
  if (f.recipient === f.sender) return 'self';
  if (f.blocked || (f.friendsOnly && !f.friends)) return 'refused';
  return null;
}

/** How many of the oldest messages of a conversation of `count` go, so that at most PM_HISTORY stay. */
export const pmExcess = (count: number): number =>
  Math.max(0, count - PM_HISTORY);

/** The two players of a conversation in a fixed order: the same pair for either direction. */
export const pmPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];

/** One message as the owner of the state sees it. */
export interface PmLine {
  id: number;
  /** The viewer wrote it. */
  mine: boolean;
  time: number;
  text: string;
  /** Only a received message can be unread. */
  read: boolean;
}

/** One message the player sent, for „Gesendet“. */
export interface SentLine {
  id: number;
  /** The name of the recipient; null for a deleted account. */
  to: string | null;
  time: number;
  text: string;
}

/**
 * The conversation the browser has open and the newest message it holds of it
 * (Q32): the state then carries the messages that are newer. `name` is the
 * other player's name, empty for the deleted accounts.
 */
export interface PmOpen {
  name: string;
  after: number;
}

/** How many received messages of `lines` are unread. */
export const pmUnread = (lines: readonly PmLine[]): number =>
  lines.filter((l) => !l.mine && !l.read).length;

/**
 * The actions of the private messages. A player in vacation mode sends and
 * receives messages as normal (owner, 2026-11-21, Q25), so `vacationRefuses`
 * (core/vacation.ts) lets all of them through.
 */
export const PM_ACTIONS = [
  'sendPrivateMessage',
  'readPrivateMessages',
  'deletePrivateMessage',
  'deletePrivateConversation',
  'reportPrivateMessage',
  'blockPlayer',
  'unblockPlayer',
  'privateMessageOptions',
  'olderPrivateMessages',
  'openPrivateConversation',
  'sentPrivateMessages',
] as const;
