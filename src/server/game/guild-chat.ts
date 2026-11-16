// The guild chat (#169). Every message is checked here, on the server,
// against the rank of the acting member (#163); the guild view only hides
// what a rank may not do. Rules (owner, 2026-11-14; okf/features/guild-chat.md):
// one chat per guild with the rights „Chat lesen“, „Chat schreiben“ and
// „Chatnachrichten löschen“; plain text of at most 1,000 characters, escaped
// by the view; the last 500 messages of a guild are kept and every new round
// deletes them; a member who left and a deleted account show as „ehemaliges
// Mitglied“; the chat follows the guild switch of #191 (dispatch.ts and
// state.ts); admins read every chat, each read in the audit log. The server
// writes the event messages (guild-events.ts); nobody deletes them.
import {
  chatUnread,
  deleteChatError,
  MAX_CHAT_TEXT,
  seeChatError,
  sendChatError,
} from '../../core/guild-chat.ts';
import { memberPlace } from '../../core/guild-ranks.ts';
import type { ChatMessage, GuildPlayer } from '../db/repos/guilds.ts';
import type { Action } from './actions.ts';
import { clean, fail, int, type Ctx } from './context.ts';
import { membersOf, notify } from './guild-events.ts';
import {
  actor,
  asRule,
  GUILD_ERROR,
  refuse,
  type Actor,
} from './guild-ranks.ts';
import { requireGuilds } from './round.ts';

/** The refusals of `sendGuildChat` (#169), by the codes of `sendChatError` (#214). */
const SEND_ERROR = {
  right: GUILD_ERROR.right,
  empty: 'Die Nachricht ist leer.',
  length: 'Die Nachricht darf höchstens 1.000 Zeichen haben.',
  wait: 'Bitte warte kurz vor der nächsten Nachricht.',
};

/**
 * The longest body cleaned: every character takes at most two code units,
 * so a longer body is too long whatever cleaning removes, and the check
 * refuses it as sent.
 */
const MAX_BODY = 2 * MAX_CHAT_TEXT + 64;

/**
 * The text of a message as the check takes it: a string not too long to
 * clean, without control characters and trimmed; anything else as sent.
 */
const chatText = (value: unknown): unknown =>
  typeof value === 'string' && value.length <= MAX_BODY ? clean(value) : value;

export const sendGuildChat: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const text = chatText(d.text);
  const now = ctx.now();
  const last = ctx.guilds.lastChat(user.id);
  refuse(sendChatError(asRule(a), text, now, last), SEND_ERROR);
  const id = ctx.guilds.addChat(
    a.guild.id,
    user.id,
    Math.floor(now),
    text as string,
  );
  notify(ctx, a.guild, 'guild-chat', id, [user.id]);
  return null;
};

/**
 * The place of a message's author: the position of its rank (the Leitung
 * holds the rank at 0); a former member, a deleted account and a member
 * without a known rank stand lowest.
 */
function authorPlace(
  a: Actor,
  members: Map<string | null, GuildPlayer>,
  author: string | null,
): number {
  const rank = members.get(author)?.rank_id;
  return memberPlace(false, a.ranks.find((r) => r.id === rank)?.position);
}

/** A message as `deleteChatError` sees it. */
const target = (
  a: Actor,
  members: Map<string | null, GuildPlayer>,
  m: ChatMessage,
) => ({
  kind: m.kind,
  own: m.author === a.uid,
  author: authorPlace(a, members, m.author),
});

const deletable = (
  a: Actor,
  members: Map<string | null, GuildPlayer>,
  m: ChatMessage,
): boolean => deleteChatError(asRule(a), target(a, members, m)) === null;

export const deleteGuildChat: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  const found = ctx.guilds.chatMessage(int(d.id, 0, Number.MAX_SAFE_INTEGER));
  const message = found?.guild_id === a.guild.id ? found : undefined;
  const members = membersOf(a.guild, ctx.guilds.players());
  refuse(deleteChatError(asRule(a), message && target(a, members, message)), {
    right: GUILD_ERROR.right,
    message: 'Diese Nachricht gibt es nicht.',
    event: 'Ereignisse lassen sich nicht löschen.',
    lower: GUILD_ERROR.lower,
  });
  ctx.guilds.deleteChat(message!.id);
  return 'Nachricht gelöscht.';
};

/** The name of the author while a member of the guild, else none: „ehemaliges Mitglied“ (D7). */
const nameOf = (
  members: Map<string | null, GuildPlayer>,
  author: string | null,
) => members.get(author)?.name ?? null;

/**
 * An entry as the chat shows it: a message with the name of its author
 * while a member; an event with the current names of the accounts it
 * names, none once deleted (owner, 2026-11-15), and an attack with its
 * arrival.
 */
function entry(members: Map<string | null, GuildPlayer>, m: ChatMessage) {
  const shown = { id: m.id, time: m.time, kind: m.kind, text: m.text };
  if (m.kind === 'message')
    return { ...shown, name: nameOf(members, m.author) };
  if (m.kind !== 'attack') return { ...shown, name: m.member_name };
  return {
    ...shown,
    name: m.member_name,
    attacker: m.attacker_name,
    arrival: m.arrival,
  };
}

/**
 * The chat for a member of the guild: the messages only with „Chat lesen“,
 * with each whether the member may delete it, and whether any is new since
 * its last visit (the red mark). None without a chat right.
 */
export function chatState(ctx: Ctx, a: Actor, players: GuildPlayer[]) {
  const read = a.rights.has('chat-read');
  const write = a.rights.has('chat-write');
  if (!read && !write) return null;
  const members = membersOf(a.guild, players);
  const chat = read ? ctx.guilds.chat(a.guild.id) : [];
  const seen = ctx.guilds.membership(a.uid)!.chat_seen;
  return {
    read,
    write,
    messages: chat.map((m) => ({
      ...entry(members, m),
      delete: deletable(a, members, m),
    })),
    unread: chatUnread(
      chat.map((m) => ({ id: m.id, own: m.author === a.uid })),
      seen,
    ),
  };
}

/**
 * The member has the page of its guild open and saw the chat up to the
 * message `id` (the red mark, owner, 2026-11-15); never past the newest
 * message of its guild, never back.
 */
export const seeGuildChat: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  refuse(seeChatError(asRule(a)), GUILD_ERROR);
  const newest = ctx.guilds.chat(a.guild.id).at(-1)?.id ?? 0;
  ctx.guilds.seeChat(
    user.id,
    Math.min(int(d.id, 0, Number.MAX_SAFE_INTEGER), newest),
  );
  return null;
};

/**
 * The chat of any guild for the admin (owner, 2026-11-14, D8); the route
 * records every read in the audit log. None while guilds are off.
 */
export function adminGuildChat(ctx: Ctx, id: string) {
  requireGuilds(ctx);
  const guild = ctx.guilds.get(id) ?? fail('Diese Gilde gibt es nicht.');
  const members = membersOf(guild, ctx.guilds.players());
  return {
    guild: { id: guild.id, tag: guild.tag, name: guild.name },
    messages: ctx.guilds.chat(guild.id).map((m) => entry(members, m)),
  };
}
