// Migration 2, numbered by its place before the IDs (#213).
export const id = '20261107T0911-account-tokens';
export const number = 2;
export const sql = `
  CREATE TABLE account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('reset', 'login')),
    code_hash TEXT,
    expires INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE UNIQUE INDEX account_login_user ON account_tokens(user_id) WHERE purpose = 'login';
  CREATE INDEX account_tokens_user ON account_tokens(user_id, purpose, expires);
  CREATE INDEX account_tokens_expiry ON account_tokens(expires);
  `;
