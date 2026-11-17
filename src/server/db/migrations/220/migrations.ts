// The migrations of #220. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261116T2137-round-start: the start of the round, for the day of the
// round that scales the daily reward (#220). A round that runs already
// starts at the creation of its first planet (a new round places every home
// planet at its start), a universe without a planet at the time of the
// migration ([V]); a stored start stays.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261116T2137-round-start',
    sql: `
    INSERT OR IGNORE INTO settings (key, value)
    SELECT 'roundStart', COALESCE(
      (SELECT MIN(created) FROM planets),
      CAST(strftime('%s', 'now') AS INTEGER) * 1000
    );
  `,
  },
];

export default migrations;
