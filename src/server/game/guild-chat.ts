// The guild chat (#169). Every message is checked here, on the server,
// against the rank of the acting member (#163); the guild view only hides
// what a rank may not do. Rules (owner, 2026-11-14; okf/features/guild-chat.md):
// one chat per guild with the rights „Chat lesen“, „Chat schreiben“ and
// „Chatnachrichten löschen“; plain text of at most 1,000 characters, escaped
// by the view; the last 500 messages of a guild are kept and every new round
// deletes them; a member who left and a deleted account show as „ehemaliges
// Mitglied“; the chat follows the guild switch of #191 (dispatch.ts and
// state.ts); admins read every chat, each read in the audit log.
import {
  canDeleteChat,
  CHAT_INTERVAL,
  chatTextError,
  MAX_CHAT_TEXT,
} from '../../core/guild-chat.ts';
import { memberPlace, type GuildRight } from '../../core/guild-ranks.ts';
import type { ChatMessage, Guild, GuildPlayer } from '../db/repos/guilds.ts';
import { queuePush } from '../push-store.ts';
import type { Action } from './actions.ts';
import { clean, fail, int, type Ctx } from './context.ts';
import { actor, asRule, need, type Actor } from './guild-ranks.ts';
import { requireGuilds } from './round.ts';

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

/** The members of a guild, by id; an anonymous author (null) is none of them. */
function membersOf(
  guild: Guild,
  players: GuildPlayer[],
): Map<string | null, GuildPlayer> {
  return new Map(
    players
      .filter((p) => p.guild_id === guild.id && p.status === 'member')
      .map((p) => [p.id, p]),
  );
}

/** Whether the member holds a right: the Leitung holds every one. */
function holds(a: Actor, p: GuildPlayer, right: GuildRight): boolean {
  if (p.id === a.guild.founder) return true;
  return !!a.ranks.find((r) => r.id === p.rank_id)?.rights.includes(right);
}

/** Every member who reads the chat, but the writer, gets a push of the kind „guild-chat“ (#192, D5). */
function notify(ctx: Ctx, a: Actor, id: number): void {
  for (const p of membersOf(a.guild, ctx.guilds.players()).values())
    if (p.id !== a.uid && holds(a, p, 'chat-read'))
      queuePush(ctx, p.id, {
        kind: 'guilds',
        topic: 'guild-chat',
        key: `chat${id}`,
        due: ctx.now(),
      });
}

export const sendGuildChat: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'chat-write');
  const text = chatText(d.text);
  const now = ctx.now();
  const last = ctx.guilds.lastChat(user.id) ?? -Infinity;
  if (now - last < CHAT_INTERVAL)
    fail('Bitte warte kurz vor der nächsten Nachricht.');
  notify(
    ctx,
    a,
    ctx.guilds.addChat(a.guild.id, user.id, Math.floor(now), text),
  );
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
  canDeleteChat(
    asRule(a),
    m.author === a.uid,
    authorPlace(a, members, m.author),
  );

export const deleteGuildChat: Action = (ctx, user, d) => {
  const a = actor(ctx, user.id);
  need(a, 'chat-delete');
  const message = ctx.guilds.chatMessage(int(d.id, 0, Number.MAX_SAFE_INTEGER));
  if (message?.guild_id !== a.guild.id)
    return fail('Diese Nachricht gibt es nicht.');
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
 * The chat for a member of the guild: the messages only with „Chat lesen“,
 * and with each whether the member may delete it. None without a chat right.
 */
export function chatState(ctx: Ctx, a: Actor, players: GuildPlayer[]) {
  const read = a.rights.has('chat-read');
  const write = a.rights.has('chat-write');
  if (!read && !write) return null;
  const members = membersOf(a.guild, players);
  return {
    read,
    write,
    messages: read
      ? ctx.guilds.chat(a.guild.id).map((m) => ({
          id: m.id,
          time: m.time,
          name: nameOf(members, m.author),
          text: m.text,
          delete: deletable(a, members, m),
        }))
      : [],
  };
}

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
    messages: ctx.guilds.chat(guild.id).map((m) => ({
      id: m.id,
      time: m.time,
      name: nameOf(members, m.author),
      text: m.text,
    })),
  };
}
