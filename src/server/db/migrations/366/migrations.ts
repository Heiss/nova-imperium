// The migrations of #366. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261124T1114-main-lock-end: the end of the lock of the main planet is
// stored at the switch (owner, 2026-11-22), so a change of the setting
// during the round counts only for later switches. Every lock that exists
// at the upgrade gets the end it has by the rule before: the time of the
// switch plus the days of the round then, 7 without a setting [V].
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261124T1114-main-lock-end',
    sql: `
    ALTER TABLE users ADD COLUMN main_lock_end INTEGER;
    UPDATE users SET main_lock_end = main_switched + COALESCE(
      (SELECT value FROM settings WHERE key = 'roundMainLock'), 7
    ) * 86400000
    WHERE main_switched IS NOT NULL;
  `,
  },
];

export default migrations;
