// The migrations of #223. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261117T1000-vacation-mode: when a player's vacation mode started
// (#223); null outside of it. A running round has no player in vacation
// mode yet, so every existing player starts without one.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261117T1000-vacation-mode',
    sql: `
    ALTER TABLE users ADD COLUMN vacation INTEGER;
  `,
  },
];

export default migrations;
