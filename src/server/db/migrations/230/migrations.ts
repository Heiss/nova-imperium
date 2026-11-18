// The migrations of #230. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261117T1158-jump-gate: when the Warp-Tor of a moon is ready again after
// a jump (#53, #230), so the cooldown holds after a restart. One row per
// moon whose gate has cooled down once; a moon without a row is ready. The
// row goes with its moon, when the moon breaks (#95) and at a new round.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261117T1158-jump-gate',
    sql: `
    CREATE TABLE jump_gates (
      moon_id TEXT PRIMARY KEY REFERENCES planets(id) ON DELETE CASCADE,
      ready INTEGER NOT NULL
    ) STRICT;
  `,
  },
];

export default migrations;
