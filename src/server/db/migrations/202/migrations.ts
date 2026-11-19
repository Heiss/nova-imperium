// The migrations of #202. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261117T0921-demolition: what a demolition of the build queue gives
// back at its end (#202, D7). A running upgrade has none (NULL), so every
// order of a running round stays an upgrade.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261117T0921-demolition',
    sql: `
    ALTER TABLE planets ADD COLUMN bq_back_m INTEGER;
    ALTER TABLE planets ADD COLUMN bq_back_c INTEGER;
    ALTER TABLE planets ADD COLUMN bq_back_d INTEGER;
  `,
  },
];

export default migrations;
