// The migrations of #229. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261117T0923-activity-times: the public activity markers (#229). Each
// planet and moon keeps the time of its last activity, each account the
// time of its last login or manual action. A planet starts without
// activity; an account starts with its last interaction of the private
// activity samples (`player_activity`, kept 30 days), without one the
// server counts from the account's creation.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261117T0923-activity-times',
    sql: `
    ALTER TABLE planets ADD COLUMN active_at INTEGER;
    ALTER TABLE users ADD COLUMN active_at INTEGER;
    UPDATE users SET active_at =
      (SELECT MAX(last_seen) FROM player_activity WHERE player = users.id);
  `,
  },
];

export default migrations;
