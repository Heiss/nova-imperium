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
  canDeleteChat,
  CHAT_INTERVAL,
  chatTextError,
  chatUnread,
  MAX_CHAT_TEXT,
} from '../../core/guild-chat.ts';
import { memberPlace } from '../../core/guild-ranks.ts';
import type { ChatMessage, GuildPlayer } from '../db/repos/guilds.ts';
import type { Handler } from './actions.ts';
import { clean, fail, int, type Ctx } from './context.ts';
import { membersOf, notify } from './guild-events.ts';
import { actor, asRule, need, type Actor } from './guild-ranks.ts';
import { requireGuilds } from './round.ts';
import type { ServerFeature } from './feature.ts';

const TEXT_ERROR = {
  empty: 'Die Nachricht ist leer.',
  length: 'Die Nachricht darf höchstens 1.000 Zeichen haben.',
};

/** The text of a message: plain text without control characters, trimmed. */
function chatText(value: unknown): string {
  if (typeof value !== 'string') return fail(TEXT_ERROR.empty);
  // Every character takes at most two code units: longer is too long.
  if (value.length > 2 * MAX_CHAT_TEXT + 64) return fail(TEXT_ERROR.length);
  const text = clean(value);
  const error = chatTextError(text);
  if (error) fail(TEXT_ERROR[error]);
  return text;
}

const sendGuildChat: Handler<'sendGuildChat'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'chat-write');
  const text = chatText(d.text);
  const now = ctx.now();
  const last = ctx.guilds.lastChat(user.id) ?? -Infinity;
  if (now - last < CHAT_INTERVAL)
    fail('Bitte warte kurz vor der nächsten Nachricht.');
  const id = ctx.guilds.addChat(a.guild.id, user.id, Math.floor(now), text);
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

const deletable = (
  a: Actor,
  members: Map<string | null, GuildPlayer>,
  m: ChatMessage,
): boolean =>
  m.kind === 'message' &&
  canDeleteChat(
    asRule(a),
    m.author === a.uid,
    authorPlace(a, members, m.author),
  );

const deleteGuildChat: Handler<'deleteGuildChat'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'chat-delete');
  const message = ctx.guilds.chatMessage(int(d.id, 0, Number.MAX_SAFE_INTEGER));
  if (message?.guild_id !== a.guild.id)
    return fail('Diese Nachricht gibt es nicht.');
  if (message.kind !== 'message') fail('Ereignisse lassen sich nicht löschen.');
  if (!deletable(a, membersOf(a.guild, ctx.guilds.players()), message))
    fail('Das geht nur bei Rängen unter deinem.');
  ctx.guilds.deleteChat(message.id);
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
const seeGuildChat: Handler<'seeGuildChat'> = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'chat-read');
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

export const serverFeature = {
  guildActions: { sendGuildChat, deleteGuildChat, seeGuildChat },
} satisfies ServerFeature;
