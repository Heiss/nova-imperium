// Private messages between players (#226, okf/features/private-messages.md).
// Every action is checked here, on the server; the sender is always the
// authenticated account, never a field of the input. The rules are those of
// src/core/private-messages.ts (the length, the rate limit, who may write to
// whom, the cap of 500 per conversation); this file gathers the facts and
// words the codes. The state holds only the conversations of the player; the
// text never goes into the journal or the audit log, and a push never carries
// it. A new round deletes the messages and the reports (the repository).
import { relationOf } from '../../core/friends.ts';
import {
  MAX_PM_TEXT,
  PM_ERROR_TEXT,
  pmTextError,
  pmTooSoon,
  pmUnread,
  sendError,
  type PmError,
  type PmLine,
} from '../../core/private-messages.ts';
import { DELETED_PLAYER } from '../../core/round-report.ts';
import type { StateShape } from '../../core/state/private-messages.ts';
import type {
  MessageReport,
  PrivateMessage,
} from '../db/repos/private-messages.ts';
import { queuePush } from '../push-store.ts';
import type { Handler } from './actions.ts';
import { clean, type Ctx, fail, str } from './context.ts';
import type { ServerFeature, StatePart } from './feature.ts';

/** The text of the push: never the message or the sender (owner, 2026-11-21). */
const PM_PUSH_TEXT = 'Neue persönliche Nachricht';

/** The German answers of the actions besides the codes of the core [V]. */
const PM_TEXT = {
  gone: 'Diese Nachricht gibt es nicht.',
  reported: 'Nachricht gemeldet.',
  alreadyReported: 'Diese Nachricht hast du bereits gemeldet.',
  blocked: 'Spieler blockiert.',
  unblocked: 'Blockierung aufgehoben.',
  saved: 'Gespeichert.',
} as const;

const refuse = (code: PmError): never => fail(PM_ERROR_TEXT[code]);

/** The text of a message: plain text without control characters, trimmed. */
function pmText(value: unknown): string {
  if (typeof value !== 'string') return refuse('empty');
  // Every character takes at most two code units: longer is too long.
  if (value.length > 2 * MAX_PM_TEXT + 64) return refuse('length');
  const text = clean(value);
  const error = pmTextError(text);
  return error ? refuse(error) : text;
}

const friends = (ctx: Ctx, a: string, b: string): boolean =>
  relationOf(ctx.friends.links(a), a, b) === 'friends';

/**
 * The other side of a conversation by name: the id of the player, or null
 * for the empty name, which is the conversation with deleted accounts. A
 * name no player has is refused.
 */
function partner(ctx: Ctx, name: unknown): string | null {
  const text = str(name, 20);
  if (text === '') return null;
  return ctx.players.byName(text)?.id ?? refuse('unknown');
}

/** The message `id` if `uid` may see it in its own view, else refused: another player's message is „not there“. */
function ownMessage(ctx: Ctx, uid: string, id: unknown): PrivateMessage {
  const m = ctx.privateMessages.get(typeof id === 'number' ? id : -1);
  const mine =
    m &&
    ((m.sender === uid && !m.hiddenSender) ||
      (m.recipient === uid && !m.hiddenRecipient));
  return mine ? m : fail(PM_TEXT.gone);
}

const sendPrivateMessage: Handler<'sendPrivateMessage'> = (ctx, u, d) => {
  const text = pmText(d.text);
  const to = ctx.players.byName(str(d.name, 20));
  const store = ctx.privateMessages;
  const error = sendError({
    sender: u.id,
    recipient: to?.id ?? null,
    blocked: !!to && store.isBlocked(to.id, u.id),
    friendsOnly: !!to && store.friendsOnly(to.id),
    friends: !!to && friends(ctx, u.id, to.id),
  });
  if (error) refuse(error);
  const now = ctx.now();
  if (pmTooSoon(now, store.lastSent(u.id))) refuse('rate');
  const id = store.add(u.id, to!.id, Math.floor(now), text);
  queuePush(ctx, to!.id, {
    kind: 'messages',
    topic: 'private-messages',
    key: `pm${id}`,
    due: now,
    body: PM_PUSH_TEXT,
  });
  return null;
};

/** The player read the conversation with `d.name`: its received messages are read. */
const readPrivateMessages: Handler<'readPrivateMessages'> = (ctx, u, d) => {
  ctx.privateMessages.markRead(u.id, partner(ctx, d.name));
  return null;
};

/** Deletes one message from the own view only; the other side keeps it. */
const deletePrivateMessage: Handler<'deletePrivateMessage'> = (ctx, u, d) => {
  ctx.privateMessages.hide(u.id, ownMessage(ctx, u.id, d.id).id);
  return null;
};

/** Deletes the whole conversation from the own view only. */
const deletePrivateConversation: Handler<'deletePrivateConversation'> = (
  ctx,
  u,
  d,
) => {
  ctx.privateMessages.hideConversation(u.id, partner(ctx, d.name));
  return null;
};

/**
 * Reports a received message to the admin (owner, 2026-11-21, Q24): only the
 * recipient of exactly that message can, so a report is never a way to read
 * another message. The report keeps a copy of the text; the admin sees
 * nothing else of the conversation.
 */
const reportPrivateMessage: Handler<'reportPrivateMessage'> = (ctx, u, d) => {
  const m = ownMessage(ctx, u.id, d.id);
  if (m.recipient !== u.id) fail(PM_TEXT.gone);
  if (!ctx.privateMessages.report(m, Math.floor(ctx.now())))
    fail(PM_TEXT.alreadyReported);
  return PM_TEXT.reported;
};

/** Blocks a player: it can no longer send to the blocker (the refusal does not say why). */
const blockPlayer: Handler<'blockPlayer'> = (ctx, u, d) => {
  const other = ctx.players.byName(str(d.name, 20)) ?? refuse('unknown');
  if (other.id === u.id) refuse('self');
  ctx.privateMessages.block(u.id, other.id);
  return PM_TEXT.blocked;
};

const unblockPlayer: Handler<'unblockPlayer'> = (ctx, u, d) => {
  const id = partner(ctx, d.name);
  if (id !== null) ctx.privateMessages.unblock(u.id, id);
  return PM_TEXT.unblocked;
};

/** The switch „only friends may write to me“. */
const privateMessageOptions: Handler<'privateMessageOptions'> = (ctx, u, d) => {
  ctx.privateMessages.setFriendsOnly(u.id, d.friendsOnly === true);
  return PM_TEXT.saved;
};

/**
 * The private messages of `uid`: its conversations, newest first, each with
 * the messages it did not delete and the number it did not read. A message
 * of a deleted account shows under the pseudonym of the round archive.
 */
export function privateMessageState(
  ctx: Ctx,
  uid: string,
): StateShape['privateMessages'] {
  const names = new Map(ctx.players.all().map((p) => [p.id, p.name]));
  const groups = new Map<string | null, PmLine[]>();
  for (const m of ctx.privateMessages.visibleTo(uid)) {
    const mine = m.sender === uid;
    const other = mine ? m.recipient : m.sender;
    const lines = groups.get(other) ?? [];
    lines.push({
      id: m.id,
      mine,
      time: m.time,
      text: m.text,
      read: m.read,
    });
    groups.set(other, lines);
  }
  const conversations = [...groups.entries()]
    .map(([other, messages]) => ({
      with: other === null ? null : (names.get(other) ?? null),
      unread: pmUnread(messages),
      messages,
    }))
    .sort((a, b) => b.messages.at(-1)!.id - a.messages.at(-1)!.id);
  return {
    friendsOnly: ctx.privateMessages.friendsOnly(uid),
    blocked: ctx.privateMessages
      .blockedBy(uid)
      .map((id) => names.get(id) ?? DELETED_PLAYER)
      .sort((a, b) => a.localeCompare(b, 'de')),
    conversations,
  };
}

/** A report as the admin sees it: the copy of the message, its players and the times. */
export interface AdminReport {
  id: number;
  sender: string;
  recipient: string;
  /** The recipient reported it; the only one who can. */
  reporter: string;
  sent: number;
  reported: number;
  text: string;
}

const named = (name: string | null): string => name ?? DELETED_PLAYER;

/** The reported messages for the admin: only what a recipient reported, nothing around it. */
export function adminMessageReports(ctx: Ctx): AdminReport[] {
  return ctx.privateMessages.reports().map((r: MessageReport) => ({
    id: r.id,
    sender: named(r.senderName),
    recipient: named(r.recipientName),
    reporter: named(r.recipientName),
    sent: r.sent,
    reported: r.reported,
    text: r.text,
  }));
}

export const serverFeature = {
  // Not guild actions: private messages work with guilds off.
  actions: {
    sendPrivateMessage,
    readPrivateMessages,
    deletePrivateMessage,
    deletePrivateConversation,
    reportPrivateMessage,
    blockPlayer,
    unblockPlayer,
    privateMessageOptions,
  },
  state: {
    order: 230,
    keys: ['privateMessages'],
    build: (ctx, u) => ({ privateMessages: privateMessageState(ctx, u.id) }),
  } satisfies StatePart<StateShape>,
} satisfies ServerFeature;
