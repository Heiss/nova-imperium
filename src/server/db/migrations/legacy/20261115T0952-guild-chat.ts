// Migration 20, numbered by its place before the IDs (#213).
// the guild chat (issue #169). Three new rights, so the CHECK of
// guild_rank_rights needs a rebuild; nothing references the table. Every
// existing rank below the Leitung gets „Chat lesen“ and „Chat schreiben“;
// only the Leitung deletes (owner, 2026-11-15). A message keeps its author
// until the account is deleted, then it is anonymous (owner, D7); it goes
// with its guild. An event (D3, D4) has no author: it names the member it
// is about, and an attack also the attacker and the arrival; a deleted
// account leaves its place empty. `chat_seen` of a member is the newest
// message of its last visit to the page of its guild (the red mark,
// owner, 2026-11-15).
export const id = '20261115T0952-guild-chat';
export const number = 20;
export const sql = `
  CREATE TABLE guild_rank_rights_new (
    rank_id TEXT NOT NULL REFERENCES guild_ranks(id) ON DELETE CASCADE,
    right_key TEXT NOT NULL
      CHECK (right_key IN ('applications', 'remove', 'assign', 'profile', 'ranks',
        'chat-read', 'chat-write', 'chat-delete')),
    PRIMARY KEY (rank_id, right_key)
  ) STRICT;
  INSERT INTO guild_rank_rights_new (rank_id, right_key)
    SELECT rank_id, right_key FROM guild_rank_rights;
  DROP TABLE guild_rank_rights;
  ALTER TABLE guild_rank_rights_new RENAME TO guild_rank_rights;
  INSERT OR IGNORE INTO guild_rank_rights (rank_id, right_key)
    SELECT k.id, r.right_key FROM guild_ranks k,
      (SELECT 'chat-read' AS right_key UNION ALL SELECT 'chat-write') r
    WHERE k.position > 0;
  CREATE TABLE guild_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    author TEXT REFERENCES users(id) ON DELETE SET NULL,
    time INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'message'
      CHECK (kind IN ('message', 'join', 'leave', 'remove', 'rank', 'attack')),
    text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 1000
      OR (kind IN ('join', 'leave', 'remove') AND text = '')),
    member TEXT REFERENCES users(id) ON DELETE SET NULL,
    attacker TEXT REFERENCES users(id) ON DELETE SET NULL,
    arrival INTEGER,
    CHECK (kind = 'message' OR author IS NULL),
    CHECK (kind != 'message' OR (member IS NULL AND attacker IS NULL)),
    CHECK ((kind = 'attack') = (arrival IS NOT NULL))
  ) STRICT;
  CREATE INDEX guild_chat_guild ON guild_chat(guild_id, id);
  CREATE INDEX guild_chat_author ON guild_chat(author);
  CREATE INDEX guild_chat_member ON guild_chat(member);
  CREATE INDEX guild_chat_attacker ON guild_chat(attacker);
  ALTER TABLE guild_members ADD COLUMN chat_seen INTEGER NOT NULL DEFAULT 0;
  `;
