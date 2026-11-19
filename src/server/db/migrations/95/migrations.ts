// The migrations of #95. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  // The mission Mondbruch (#95): the CHECK of fleets.mission allows
  // `moonbreak`, which needs a rebuild of fleets and fleet_ships as
  // migration 16 did. Every column stays, `gift` of migration 18 included,
  // with the index fleets_owner, the foreign keys and the cascades. It runs
  // after 20261119T0744-holding (#55), which rebuilt fleets with the column
  // `hold` and the state 'hold' and must stay as it is on main: this rebuild
  // keeps both, so the three rebuilds of fleets (this one, the survey and the
  // missiles) follow it in this order.
  {
    id: '20261119T0810-moonbreak',
    sql: `
  ALTER TABLE fleet_ships RENAME TO old_fleet_ships;
  ALTER TABLE fleets RENAME TO old_fleets;
  DROP INDEX fleets_owner;

  CREATE TABLE fleets (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_planet TEXT NOT NULL,
    from_g INTEGER NOT NULL,
    from_s INTEGER NOT NULL,
    from_p INTEGER NOT NULL,
    to_planet TEXT NOT NULL,
    to_g INTEGER NOT NULL,
    to_s INTEGER NOT NULL,
    to_p INTEGER NOT NULL,
    mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize', 'deploy', 'harvest', 'hold', 'moonbreak')),
    cargo_m REAL NOT NULL,
    cargo_c REAL NOT NULL,
    cargo_d REAL NOT NULL,
    dep INTEGER NOT NULL,
    arr INTEGER NOT NULL,
    ret INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('out', 'hold', 'back')),
    recalled INTEGER NOT NULL DEFAULT 0,
    fuel INTEGER NOT NULL DEFAULT 0,
    gift INTEGER NOT NULL DEFAULT 0 CHECK (gift IN (0, 1)),
    hold INTEGER NOT NULL DEFAULT 0 CHECK (hold >= 0)
  ) STRICT;
  CREATE INDEX fleets_owner ON fleets(owner);

  CREATE TABLE fleet_ships (
    fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (fleet_id, key)
  ) STRICT;

  INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet,
    to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state,
    recalled, fuel, gift, hold)
  SELECT id, owner, from_planet, from_g, from_s, from_p, to_planet,
    to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state,
    recalled, fuel, gift, hold
  FROM old_fleets;
  INSERT INTO fleet_ships (fleet_id, key, count)
    SELECT fleet_id, key, count FROM old_fleet_ships;
  DROP TABLE old_fleet_ships;
  DROP TABLE old_fleets;
  `,
  },
];

export default migrations;
