// Migration 4, numbered by its place before the IDs (#213).
export const id = '20261107T0945-push';
export const number = 4;
export const sql = `
  CREATE TABLE push_keys (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL
  ) STRICT;
  CREATE TABLE push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL
  ) STRICT;
  CREATE INDEX push_subscription_user ON push_subscriptions(user_id);
  CREATE TABLE push_jobs (
    endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    event_key TEXT NOT NULL,
    due REAL NOT NULL,
    retry_at REAL NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (endpoint, kind, event_key)
  ) STRICT;
  CREATE INDEX push_due ON push_jobs(retry_at);
  `;
