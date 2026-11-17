// Migration 5, numbered by its place before the IDs (#213).
export const id = '20261107T1403-achievements';
export const number = 5;
export const sql = `
  CREATE TABLE achievement_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (user_id, metric)
  ) STRICT;
  CREATE TABLE achievement_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  ) STRICT;
  CREATE TABLE daily_rewards (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_day INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    claimed_day INTEGER
  ) STRICT;
  `;
