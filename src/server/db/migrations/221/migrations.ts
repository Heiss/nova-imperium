// The migrations of #221. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261116T2211-main-planet: the main planet a player chose in the options
// and the time of the last switch, which starts the lock (#221). Without a
// choice the main planet is the first planet, as before; so every existing
// player starts without one and without a lock.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261116T2211-main-planet',
    sql: `
    ALTER TABLE users ADD COLUMN main_planet TEXT;
    ALTER TABLE users ADD COLUMN main_switched INTEGER;
  `,
  },
];

export default migrations;
