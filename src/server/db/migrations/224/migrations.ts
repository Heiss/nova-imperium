// The migrations of #224. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261117T0540-position-locks: the positions of given-up colonies and when
// their lock ends (#224, D2); no colony can be founded there before. A
// running round has given up no colony yet, so the table starts empty.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261117T0540-position-locks',
    sql: `
    CREATE TABLE position_locks (
      g INTEGER NOT NULL,
      s INTEGER NOT NULL,
      p INTEGER NOT NULL,
      until INTEGER NOT NULL,
      PRIMARY KEY (g, s, p)
    ) STRICT;
  `,
  },
];

export default migrations;
