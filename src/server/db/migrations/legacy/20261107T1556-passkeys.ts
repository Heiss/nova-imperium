// Migration 8, numbered by its place before the IDs (#213).
// passkey credentials and short-lived WebAuthn challenges
export const id = '20261107T1556-passkeys';
export const number = 8;
export const sql = `
  CREATE TABLE passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL,
    created INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX passkeys_owner ON passkeys(user_id);
  CREATE TABLE passkey_challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    session_hash TEXT,
    expires INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX passkey_challenges_expiry ON passkey_challenges(expires);
  `;
