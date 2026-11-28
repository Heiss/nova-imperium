// The migrations of #440. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261127T1800-hold-refusals: the option „Keine Wachen annehmen“ of a player
// (#440, 230b; owner, 2026-11-27), off for every player: a row per player who
// switched it on. The round setting „Wache stellen“ needs no migration: a
// universe without it reads the default „An“ (261a), as `roundMarketOn`.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261127T1800-hold-refusals',
    sql: `
    CREATE TABLE hold_refusals (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
  `,
  },
];

export default migrations;
