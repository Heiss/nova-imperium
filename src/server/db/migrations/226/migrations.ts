// The migrations of #226. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261121T1000-private-messages: private messages between players (#226,
// owner, 2026-11-21). One row per message; a conversation is the pair of its
// two players in either direction (the index on min/max). `read` is the
// recipient's mark; `hidden_sender` and `hidden_recipient` delete the message
// from one side's own view only, and the row goes once both sides hid it. The
// text is 1 to 1,000 characters (the guild chat's limit). A deleted account
// cuts its side (`sender` or `recipient` becomes NULL, shown as „Gelöschter
// Spieler“, like the round archive, owner, 2026-11-21 Q22): the conversation
// stays for the other player until the round ends; a message whose both
// sides are deleted goes (the trigger). `message_reports` holds the
// messages a recipient reported (Q24): a copy of the text at the time of the
// report, one report per message, so the admin sees only what was reported
// and the report outlives the message. `message_blocks` is the block list
// (one row per blocker and blocked player); `message_options` holds the
// switch „only friends may write to me“ (no row means off). A new round
// deletes the messages and the reports and keeps the block list and the
// switch.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261121T1000-private-messages',
    sql: `
    CREATE TABLE private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT REFERENCES users(id) ON DELETE SET NULL,
      recipient TEXT REFERENCES users(id) ON DELETE SET NULL,
      time INTEGER NOT NULL,
      text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000),
      read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
      hidden_sender INTEGER NOT NULL DEFAULT 0 CHECK (hidden_sender IN (0, 1)),
      hidden_recipient INTEGER NOT NULL DEFAULT 0 CHECK (hidden_recipient IN (0, 1)),
      CHECK (sender != recipient)
    ) STRICT;
    CREATE INDEX private_messages_pair
      ON private_messages (min(sender, recipient), max(sender, recipient), id);
    CREATE INDEX private_messages_sender ON private_messages (sender, time);
    CREATE INDEX private_messages_recipient ON private_messages (recipient);
    CREATE TRIGGER private_messages_orphans AFTER DELETE ON users
    BEGIN
      DELETE FROM private_messages WHERE sender IS NULL AND recipient IS NULL;
    END;
    CREATE TABLE message_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message INTEGER NOT NULL UNIQUE,
      sender TEXT REFERENCES users(id) ON DELETE SET NULL,
      recipient TEXT REFERENCES users(id) ON DELETE SET NULL,
      sent INTEGER NOT NULL,
      reported INTEGER NOT NULL,
      text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000)
    ) STRICT;
    CREATE INDEX message_reports_sender ON message_reports (sender);
    CREATE INDEX message_reports_recipient ON message_reports (recipient);
    CREATE TABLE message_blocks (
      blocker TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (blocker, blocked),
      CHECK (blocker != blocked)
    ) STRICT;
    CREATE INDEX message_blocks_blocked ON message_blocks (blocked);
    CREATE TABLE message_options (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      friends_only INTEGER NOT NULL CHECK (friends_only IN (0, 1))
    ) STRICT;
  `,
  },
];

export default migrations;
