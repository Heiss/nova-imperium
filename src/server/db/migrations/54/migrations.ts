// The migrations of #54. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261118T2235-missiles: the mission Raketenangriff (`missile`) and the
// main target of its missiles (`aim`, a defense key or NULL). The CHECK of
// fleets.mission needs a rebuild of fleets and fleet_ships, as in 16; every
// fleet in flight keeps its values, its gift and its ships, and has no main
// target. The Orbitalraketen and Abfangraketen are rows of planet_units, the
// Raketenkrypta a row of planet_buildings, which need no change.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261118T2235-missiles',
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
      mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize', 'deploy', 'harvest', 'moonbreak', 'survey', 'missile')),
      cargo_m REAL NOT NULL,
      cargo_c REAL NOT NULL,
      cargo_d REAL NOT NULL,
      dep INTEGER NOT NULL,
      arr INTEGER NOT NULL,
      ret INTEGER NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('out', 'back')),
      recalled INTEGER NOT NULL DEFAULT 0,
      fuel INTEGER NOT NULL DEFAULT 0,
      gift INTEGER NOT NULL DEFAULT 0 CHECK (gift IN (0, 1)),
      aim TEXT
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
      recalled, fuel, gift)
    SELECT id, owner, from_planet, from_g, from_s, from_p, to_planet,
      to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state,
      recalled, fuel, gift
    FROM old_fleets;
    INSERT INTO fleet_ships (fleet_id, key, count)
      SELECT fleet_id, key, count FROM old_fleet_ships;
    DROP TABLE old_fleet_ships;
    DROP TABLE old_fleets;
  `,
  },
];

export default migrations;
