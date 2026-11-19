// The migrations of #187. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261119T1733-level-table: the option „Stufenübersicht“ of a player (#187
// D4, D5; owner, 2026-11-14), stored on the server like the explanation
// option of #63: `always`, `icon` or `hidden`, `icon` for every player.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261119T1733-level-table',
    sql: `
    ALTER TABLE users ADD COLUMN level_table TEXT NOT NULL DEFAULT 'icon'
      CHECK (level_table IN ('always', 'icon', 'hidden'));
  `,
  },
];

export default migrations;
