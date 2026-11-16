// Migration 17, numbered by its place before the IDs (#213).
// the push kinds a player switched off (issue #192), and the kind of
// each queued push; a queued order or fleet push gets its kind, a queued
// report push keeps none and is delivered as before
export const id = '20261114T1638-push-kinds';
export const number = 17;
export const sql = `
  CREATE TABLE push_off (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    PRIMARY KEY (user_id, topic)
  ) STRICT;
  ALTER TABLE push_jobs ADD COLUMN topic TEXT;
  UPDATE push_jobs SET topic = kind
    WHERE kind IN ('buildings', 'research', 'shipyard', 'fleet');
  `;
