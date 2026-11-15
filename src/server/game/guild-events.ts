// The event messages of the guild chat (#169 D3, D4; owner, 2026-11-14 and
// 2026-11-15), written by the server and never deleted: a member joined,
// left or was removed, a member has a new rank, and an attack is launched
// at a member. Each pushes the kind „guild-events“ to the readers of the
// chat, a message „guild-chat“, neither with its text. Apart from the
// guild chat itself (guild-chat.ts), so the guild, rank and fleet actions
// write events without importing the rules of the ranks back.
import type { ChatEventKind } from '../../core/guild-chat.ts';
import type { GuildRight } from '../../core/guild-ranks.ts';
import type { PushTopic } from '../../core/push.ts';
import type { Fleet } from '../../core/types.ts';
import type { ChatEventRow, Guild, GuildPlayer } from '../db/repos/guilds.ts';
import { queuePush } from '../push-store.ts';
import { coords, type Ctx } from './context.ts';

/** The members of a guild, by id; an anonymous author (null) is none of them. */
export function membersOf(
  guild: Guild,
  players: GuildPlayer[],
): Map<string | null, GuildPlayer> {
  return new Map(
    players
      .filter((p) => p.guild_id === guild.id && p.status === 'member')
      .map((p) => [p.id, p]),
  );
}

/** Whether the member reads the chat: the Leitung holds every right. */
const reads = (
  guild: Guild,
  ranks: Map<string, readonly GuildRight[]>,
  p: GuildPlayer,
): boolean =>
  p.id === guild.founder || !!ranks.get(p.rank_id!)?.includes('chat-read');

/** The text of a push (owner, 2026-11-15): never the message or the event. */
const PUSH_TEXT = {
  'guild-chat': 'Neue Nachricht im Gilden-Chat',
  'guild-events': 'Gildenereignis',
} as const;

/**
 * Every member who reads the chat, but those in `except`, gets a push of
 * the kind „guild-chat“ for a message or „guild-events“ for an event (#192,
 * D5); it opens the guild view.
 */
export function notify(
  ctx: Ctx,
  guild: Guild,
  topic: Extract<PushTopic, 'guild-chat' | 'guild-events'>,
  id: number,
  except: readonly string[],
): void {
  const ranks = new Map(
    ctx.guilds.ranks(guild.id).map((r) => [r.id, r.rights]),
  );
  for (const p of membersOf(guild, ctx.guilds.players()).values())
    if (!except.includes(p.id) && reads(guild, ranks, p))
      queuePush(ctx, p.id, {
        kind: 'guilds',
        topic,
        key: `chat${id}`,
        due: ctx.now(),
        body: PUSH_TEXT[topic],
      });
}

/**
 * Writes an event into the chat of a guild (D3, D4) and pushes it to the
 * readers, but not to the member it is about nor to the one who caused it.
 */
function chatEvent(
  ctx: Ctx,
  guild: string,
  event: ChatEventRow,
  by: string | null = null,
): void {
  const g = ctx.guilds.get(guild)!;
  const id = ctx.guilds.addChatEvent(guild, Math.floor(ctx.now()), event);
  notify(ctx, g, 'guild-events', id, by ? [event.member, by] : [event.member]);
}

/**
 * A member joined, left or was removed (owner, 2026-11-15): „Anna ist der
 * Gilde beigetreten.“; `by` is the member who accepted or removed it.
 */
export function memberEvent(
  ctx: Ctx,
  guild: string,
  kind: Extract<ChatEventKind, 'join' | 'leave' | 'remove'>,
  uid: string,
  by: string | null = null,
): void {
  chatEvent(ctx, guild, { kind, member: uid, text: '' }, by);
}

/** A member has a new rank: „Anna ist jetzt Offizier.“ (owner, 2026-11-15). */
export function rankEvent(
  ctx: Ctx,
  guild: string,
  uid: string,
  rank: string,
  by: string,
): void {
  chatEvent(ctx, guild, { kind: 'rank', member: uid, text: rank }, by);
}

/**
 * An attack is launched at a member of a guild: „⚔ Angriff auf [1:27:11]
 * (Vex → Lea), Ankunft 20:15“, only at the launch (owner, D3 and
 * 2026-11-15). The defender's guild gets it; nothing for one in no guild.
 */
export function attackEvent(ctx: Ctx, fleet: Fleet, defender: string): void {
  const member = ctx.guilds.membership(defender);
  if (member?.status !== 'member') return;
  chatEvent(ctx, member.guild_id, {
    kind: 'attack',
    member: defender,
    text: coords(fleet.toC),
    attacker: fleet.owner,
    arrival: fleet.arr,
  });
}
