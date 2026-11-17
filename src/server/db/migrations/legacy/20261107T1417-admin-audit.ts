// Migration 6, numbered by its place before the IDs (#213).
// admin audit, activity estimates and account suspensions
export const id = '20261107T1417-admin-audit';
export const number = 6;
export const sql = `
  CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time INTEGER NOT NULL,
    actor TEXT,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    target TEXT,
    request_id TEXT,
    detail TEXT NOT NULL
  ) STRICT;
  CREATE INDEX audit_time ON audit_events(time);
  CREATE INDEX audit_actor ON audit_events(actor, id);
  CREATE INDEX audit_target ON audit_events(target, id);

  CREATE TABLE player_activity (
    player TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    active_ms INTEGER NOT NULL,
    PRIMARY KEY (player, day)
  ) STRICT;

  CREATE TABLE suspensions (
    player TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    until INTEGER
  ) STRICT;
  `;
