// The migrations of #292. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261119T1830-last-targets: the last hostile targets of a player for the
// Schnellwahl of the fleet form (#292; owner, 2026-11-17): one row per player
// and target place, written when a Sturmangriff or an Auspex-Erkundung is
// sent, with the owner the place had then (a place that changed its owner
// drops out) and the time. The rows of a player go with the player.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261119T1830-last-targets',
    sql: `
    CREATE TABLE last_targets (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      place TEXT NOT NULL,
      owner TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY (user_id, place)
    ) STRICT;
    CREATE INDEX last_targets_user ON last_targets (user_id, at DESC);
  `,
  },
];

export default migrations;
