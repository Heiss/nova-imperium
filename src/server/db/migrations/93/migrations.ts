// The migrations of #93. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261119T1700-expeditions: the mission Expedition (`expedition`). The CHECK
// of fleets.mission needs a rebuild of fleets and fleet_ships, as in 54; it
// runs after the rebuilds of Halten (20261119T0744-holding), the Mondbruch,
// the survey and the missiles, lists every mission and every state of the
// game (`hold` among them) and keeps every column (`fuel`, `gift`, `hold`,
// `aim`). Every fleet in flight keeps its values, its gift, its holding
// time, its main target and its ships. The stay of an expedition needs no
// column and no state: it is what lies between `dep`, `arr` and `ret`, and
// the fleet stays in the state 'out' until its stay ends, so it is never a
// fleet that holds (`hold` is only written for the mission Halten).
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261119T1700-expeditions',
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
      mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize', 'deploy', 'harvest', 'hold', 'moonbreak', 'survey', 'missile', 'expedition')),
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
      hold INTEGER NOT NULL DEFAULT 0 CHECK (hold >= 0),
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
      recalled, fuel, gift, hold, aim)
    SELECT id, owner, from_planet, from_g, from_s, from_p, to_planet,
      to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state,
      recalled, fuel, gift, hold, aim
    FROM old_fleets;
    INSERT INTO fleet_ships (fleet_id, key, count)
      SELECT fleet_id, key, count FROM old_fleet_ships;
    DROP TABLE old_fleet_ships;
    DROP TABLE old_fleets;
  `,
  },
];

export default migrations;
