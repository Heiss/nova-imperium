// Migration 19, numbered by its place before the IDs (#213).
// guild ranks with rights (issue #163). A rank has a place in the
// order of its guild (0 is the Leitung, a larger number a lower rank) and
// a set of rights; the Leitung holds all rights in code, not in rows.
// Every guild gets the ranks Leitung (held by the founder) and Mitglied
// (its default rank); every other member gets Mitglied, an applicant none.
export const id = '20261114T1856-guild-ranks';
export const number = 19;
export const sql = `
  CREATE TABLE guild_ranks (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (guild_id, position)
  ) STRICT;
  CREATE TABLE guild_rank_rights (
    rank_id TEXT NOT NULL REFERENCES guild_ranks(id) ON DELETE CASCADE,
    right_key TEXT NOT NULL
      CHECK (right_key IN ('applications', 'remove', 'assign', 'profile', 'ranks')),
    PRIMARY KEY (rank_id, right_key)
  ) STRICT;
  ALTER TABLE guilds ADD COLUMN default_rank TEXT REFERENCES guild_ranks(id);
  ALTER TABLE guild_members ADD COLUMN rank_id TEXT REFERENCES guild_ranks(id);
  CREATE INDEX guild_members_rank ON guild_members(rank_id);
  INSERT INTO guild_ranks (id, guild_id, name, position)
    SELECT 'r0_' || id, id, 'Leitung', 0 FROM guilds;
  INSERT INTO guild_ranks (id, guild_id, name, position)
    SELECT 'r1_' || id, id, 'Mitglied', 1 FROM guilds;
  UPDATE guilds SET default_rank = 'r1_' || id;
  UPDATE guild_members
    SET rank_id = CASE
      WHEN user_id = (SELECT founder FROM guilds WHERE guilds.id = guild_members.guild_id)
      THEN 'r0_' ELSE 'r1_' END || guild_id
    WHERE status = 'member';
  `;
