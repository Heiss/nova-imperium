// The migrations of #181. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261121T1900-bot-check: the check for control by an AI or a program,
// switched on per player by the admin (#181, owner, 2026-11-14 and
// 2026-11-21). One row per player while the check is on; `since` is the
// moment it was switched on, from which the hints are worked out (never from
// earlier data). No row means off, the default. The row stays until the
// admin switches the check off, also over a new round, and goes with the
// account. The hints themselves are not stored: they are read from the audit
// log and the play time when the admin opens the record.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261121T1900-bot-check',
    sql: `
    CREATE TABLE bot_checks (
      player TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      since INTEGER NOT NULL
    ) STRICT;
  `,
  },
];

export default migrations;
