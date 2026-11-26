// The migrations of #401. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261125T2000-totp: the authenticator app of an account (owner,
// 2026-11-25, 97b). The secret is stored plain, like the VAPID key (127a),
// in a table of its own, so no reader of `users` sees it; it goes with the
// account. `confirmed` 0 is a setup shown but not yet confirmed by a code,
// valid from `created` for ten minutes; `last_step` is the time step of the
// last code taken, so a used code is refused again; `attempts` counts the
// wrong codes of a setup.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261125T2000-totp',
    sql: `
    CREATE TABLE totp (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
      created INTEGER NOT NULL,
      last_step INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `,
  },
];

export default migrations;
