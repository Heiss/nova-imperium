// Migration 3, numbered by its place before the IDs (#213).
export const id = '20261107T0924-guilds';
export const number = 3;
export const sql = `
  CREATE TABLE guilds (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    description TEXT NOT NULL,
    founder TEXT NOT NULL REFERENCES users(id)
  ) STRICT;
  CREATE TABLE guild_members (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'member'))
  ) STRICT;
  CREATE INDEX guild_members_guild ON guild_members(guild_id, status);
  `;
