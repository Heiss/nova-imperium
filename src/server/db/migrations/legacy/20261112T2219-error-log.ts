// Migration 12, numbered by its place before the IDs (#213).
// server errors, browser errors and problem reports (issue #126)
export const id = '20261112T2219-error-log';
export const number = 12;
export const sql = `
  CREATE TABLE error_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('server', 'client', 'report')),
    time INTEGER NOT NULL,
    first INTEGER NOT NULL,
    player TEXT REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT,
    action TEXT NOT NULL,
    page TEXT NOT NULL,
    version TEXT NOT NULL,
    browser TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    report TEXT NOT NULL
  ) STRICT;
  CREATE INDEX error_events_time ON error_events(time);
  CREATE INDEX error_events_player ON error_events(player, kind, time);
  `;
