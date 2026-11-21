// The private messages (#226, okf/features/private-messages.md): the tables
// `private_messages`, `message_blocks` and `message_options` of migration
// 20261121T1000-private-messages. The rules are those of
// src/core/private-messages.ts; the server module
// src/server/game/private-messages.ts checks every action. A message is
// delivered to two views: each side can hide it from its own view, and the row
// goes once both did.
import { PM_HISTORY } from '../../../core/private-messages.ts';
import type { Db } from '../database.ts';
import type { RepositoryModule } from './contract.ts';
import type { Row } from './rows.ts';
import type { RoundReset } from '../round-reset.ts';

/** A message as stored; `read` is the mark of the recipient. */
export interface PrivateMessage {
  id: number;
  /** The account that wrote it; null once that account is deleted. */
  sender: string | null;
  /** The account it went to; null once that account is deleted. */
  recipient: string | null;
  time: number;
  text: string;
  read: boolean;
  hiddenSender: boolean;
  hiddenRecipient: boolean;
}

/** A reported message as the admin sees it: a copy of the text at the time of the report. */
export interface MessageReport {
  id: number;
  /** The id of the reported message. */
  message: number;
  sender: string | null;
  senderName: string | null;
  recipient: string | null;
  recipientName: string | null;
  sent: number;
  reported: number;
  text: string;
}

export interface PrivateMessages {
  /** Adds a message and keeps only the newest PM_HISTORY of the conversation; returns its id. */
  add(sender: string, recipient: string, time: number, text: string): number;
  /** The time of the newest message `uid` sent, hidden or not. */
  lastSent(uid: string): number | undefined;
  /** Every message `uid` has not hidden from its own view, oldest first. */
  visibleTo(uid: string): PrivateMessage[];
  get(id: number): PrivateMessage | undefined;
  /** Marks the messages `from` sent to `uid` as read; true when one changed. */
  markRead(uid: string, from: string): boolean;
  /** Hides one message from the own view of `uid`; the other side keeps it. */
  hide(uid: string, id: number): void;
  /** Hides every message of the conversation of `uid` with `other` from the own view of `uid`. */
  hideConversation(uid: string, other: string): void;
  /**
   * Stores the report of the received message `m` (a copy of its text);
   * false when it was reported before.
   */
  report(m: PrivateMessage, now: number): boolean;
  /** Every report, newest first. */
  reports(): MessageReport[];
  /** Whether `blocker` blocked `blocked`. */
  isBlocked(blocker: string, blocked: string): boolean;
  /** The players `blocker` blocked. */
  blockedBy(blocker: string): string[];
  block(blocker: string, blocked: string): void;
  unblock(blocker: string, blocked: string): void;
  /** Whether `uid` takes messages from friends only; off by default. */
  friendsOnly(uid: string): boolean;
  setFriendsOnly(uid: string, on: boolean): void;
}

const messageOf = (r: Row): PrivateMessage => ({
  id: r.id as number,
  sender: r.sender as string | null,
  recipient: r.recipient as string | null,
  time: r.time as number,
  text: r.text as string,
  read: r.read === 1,
  hiddenSender: r.hidden_sender === 1,
  hiddenRecipient: r.hidden_recipient === 1,
});

class SqlitePrivateMessages implements PrivateMessages {
  private readonly db: Db;
  constructor(db: Db) {
    this.db = db;
  }

  add(sender: string, recipient: string, time: number, text: string): number {
    const added = this.db
      .prepare(
        'INSERT INTO private_messages (sender, recipient, time, text) VALUES (?, ?, ?, ?)',
      )
      .run(sender, recipient, time, text);
    this.db
      .prepare(
        `DELETE FROM private_messages WHERE id IN (
           SELECT id FROM private_messages
           WHERE min(sender, recipient) = min(?, ?) AND max(sender, recipient) = max(?, ?)
           ORDER BY id DESC LIMIT -1 OFFSET ?)`,
      )
      .run(sender, recipient, sender, recipient, PM_HISTORY);
    return Number(added.lastInsertRowid);
  }

  lastSent(uid: string): number | undefined {
    const time = this.db
      .prepare('SELECT MAX(time) FROM private_messages WHERE sender = ?')
      .pluck()
      .get(uid) as number | null;
    return time ?? undefined;
  }

  visibleTo(uid: string): PrivateMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM private_messages
         WHERE (sender = ? AND hidden_sender = 0)
            OR (recipient = ? AND hidden_recipient = 0)
         ORDER BY id`,
      )
      .all(uid, uid) as Row[];
    return rows.map(messageOf);
  }

  get(id: number): PrivateMessage | undefined {
    const row = this.db
      .prepare('SELECT * FROM private_messages WHERE id = ?')
      .get(id) as Row | undefined;
    return row && messageOf(row);
  }

  markRead(uid: string, from: string): boolean {
    return (
      this.db
        .prepare(
          `UPDATE private_messages SET read = 1
           WHERE recipient = ? AND sender = ? AND read = 0`,
        )
        .run(uid, from).changes > 0
    );
  }

  hide(uid: string, id: number): void {
    this.db
      .prepare(
        `UPDATE private_messages SET
           hidden_sender = hidden_sender OR sender = @uid,
           hidden_recipient = hidden_recipient OR recipient = @uid
         WHERE id = @id`,
      )
      .run({ uid, id });
    this.sweep();
  }

  hideConversation(uid: string, other: string): void {
    this.db
      .prepare(
        `UPDATE private_messages SET
           hidden_sender = hidden_sender OR sender = @uid,
           hidden_recipient = hidden_recipient OR recipient = @uid
         WHERE (sender = @uid AND recipient = @other)
            OR (sender = @other AND recipient = @uid)`,
      )
      .run({ uid, other });
    this.sweep();
  }

  /** A message both sides hid is deleted; so is one the only side left hid (the other account is deleted). */
  private sweep(): void {
    this.db
      .prepare(
        `DELETE FROM private_messages
         WHERE (hidden_sender = 1 OR sender IS NULL)
           AND (hidden_recipient = 1 OR recipient IS NULL)`,
      )
      .run();
  }

  report(m: PrivateMessage, now: number): boolean {
    return (
      this.db
        .prepare(
          `INSERT OR IGNORE INTO message_reports
             (message, sender, recipient, sent, reported, text)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(m.id, m.sender, m.recipient, m.time, now, m.text).changes > 0
    );
  }

  reports(): MessageReport[] {
    const rows = this.db
      .prepare(
        `SELECT r.*, s.name AS sender_name, c.name AS recipient_name
         FROM message_reports r
         LEFT JOIN users s ON s.id = r.sender
         LEFT JOIN users c ON c.id = r.recipient
         ORDER BY r.id DESC`,
      )
      .all() as Row[];
    return rows.map((r) => ({
      id: r.id as number,
      message: r.message as number,
      sender: r.sender as string | null,
      senderName: r.sender_name as string | null,
      recipient: r.recipient as string | null,
      recipientName: r.recipient_name as string | null,
      sent: r.sent as number,
      reported: r.reported as number,
      text: r.text as string,
    }));
  }

  isBlocked(blocker: string, blocked: string): boolean {
    return (
      this.db
        .prepare(
          'SELECT 1 FROM message_blocks WHERE blocker = ? AND blocked = ?',
        )
        .pluck()
        .get(blocker, blocked) === 1
    );
  }

  blockedBy(blocker: string): string[] {
    return this.db
      .prepare('SELECT blocked FROM message_blocks WHERE blocker = ?')
      .pluck()
      .all(blocker) as string[];
  }

  block(blocker: string, blocked: string): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO message_blocks (blocker, blocked) VALUES (?, ?)',
      )
      .run(blocker, blocked);
  }

  unblock(blocker: string, blocked: string): void {
    this.db
      .prepare('DELETE FROM message_blocks WHERE blocker = ? AND blocked = ?')
      .run(blocker, blocked);
  }

  friendsOnly(uid: string): boolean {
    return (
      this.db
        .prepare('SELECT friends_only FROM message_options WHERE user_id = ?')
        .pluck()
        .get(uid) === 1
    );
  }

  setFriendsOnly(uid: string, on: boolean): void {
    this.db
      .prepare(
        `INSERT INTO message_options (user_id, friends_only) VALUES (?, ?)
         ON CONFLICT (user_id) DO UPDATE SET friends_only = excluded.friends_only`,
      )
      .run(uid, on ? 1 : 0);
  }
}

/** The private messages (#226). */
export const repository = {
  key: 'privateMessages',
  make: (db: Db): PrivateMessages => new SqlitePrivateMessages(db),
} as const satisfies RepositoryModule;

/**
 * A new round deletes the messages and the reports (owner, 2026-11-21, D1); the block list
 * and the switch „only friends“ are settings of the player and stay [V].
 */
export const roundReset = [
  { order: 120, clears: ['private_messages', 'message_reports'] },
  { keeps: ['message_blocks', 'message_options'] },
] satisfies readonly RoundReset[];
