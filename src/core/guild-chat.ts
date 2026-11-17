// The guild chat (#169): its limits and the pure rules of a message. Shared
// by the server, which checks every message, and the guild view, which
// shows only what the own rank may do. See okf/features/guild-chat.md.
import { isBelow, type RankRule } from './guild-ranks.ts';
import type { RoundSetting } from './round.ts';

/**
 * Guilds with their chat in this round (#191), a setting of the round
 * (#283): the one switch, set only when the admin starts a new round;
 * existing universes start with guilds on.
 */
export const GUILDS_SETTING = {
  kind: 'switch',
  key: 'roundGuilds',
  name: 'guilds',
  label: 'Gilden (mit Chat)',
  order: 30,
  def: true,
  refusal: 'Bitte auswählen, ob Gilden in der neuen Runde an sind.',
  note: 'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.',
} as const satisfies RoundSetting;

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

/**
 * The event messages, written by the server and never deleted (#169 D3,
 * D4): a member joined, left or was removed, a member has a new rank, and
 * the launch of an attack on a member (owner, 2026-11-14 and 2026-11-15).
 */
export const CHAT_EVENTS = [
  'join',
  'leave',
  'remove',
  'rank',
  'attack',
] as const;
export type ChatEventKind = (typeof CHAT_EVENTS)[number];

export const isChatEvent = (v: unknown): v is ChatEventKind =>
  (CHAT_EVENTS as readonly unknown[]).includes(v);

/** An event as the chat shows it. */
export interface ChatEvent {
  kind: ChatEventKind;
  /** The member it is about; null once that account is deleted. */
  name: string | null;
  /** The new rank of „rank“, the target of „attack“; empty otherwise. */
  text: string;
  /** The attacker of „attack“; null or missing once that account is deleted. */
  attacker?: string | null;
}

/** A deleted name in an event (owner, 2026-11-15), as in a message (D7). */
const FORMER = 'ehemaliges Mitglied';
/** A deleted attacker: not a member, so the name the fleet arrival uses. */
const UNKNOWN = 'Unbekannt';

/**
 * The sentence of an event (owner, 2026-11-15): „Anna ist der Gilde
 * beigetreten.“ and „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“;
 * `arrival` is the time of the arrival as the browser shows it. Plain text:
 * the view escapes it.
 */
export function chatEventText(e: ChatEvent, arrival: string): string {
  const name = e.name ?? FORMER;
  if (e.kind === 'attack')
    return `⚔ Angriff auf ${e.text} (${e.attacker ?? UNKNOWN} → ${name}), Ankunft ${arrival}`;
  const who = name.charAt(0).toUpperCase() + name.slice(1);
  if (e.kind === 'join') return `${who} ist der Gilde beigetreten.`;
  if (e.kind === 'leave') return `${who} hat die Gilde verlassen.`;
  if (e.kind === 'remove') return `${who} wurde aus der Gilde entfernt.`;
  return `${who} ist jetzt ${e.text}.`;
}

/**
 * Whether the chat has a message of another, or an event, newer than the
 * member's last visit to the page of its guild (owner, 2026-11-15): the red
 * mark on „Gilden“. `seen` is the id of the newest message of that visit.
 */
export const chatUnread = (
  messages: readonly { id: number; own: boolean }[],
  seen: number,
): boolean => messages.some((m) => !m.own && m.id > seen);
