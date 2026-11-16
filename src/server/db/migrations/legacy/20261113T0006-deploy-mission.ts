// Migration 13, numbered by its place before the IDs (#213).
// the deploy mission and the fuel a fleet burnt (issue #129)
export const id = '20261113T0006-deploy-mission';
export const number = 13;
export const sql = `
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
    mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize', 'deploy')),
    cargo_m REAL NOT NULL,
    cargo_c REAL NOT NULL,
    cargo_d REAL NOT NULL,
    dep INTEGER NOT NULL,
    arr INTEGER NOT NULL,
    ret INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('out', 'back')),
    recalled INTEGER NOT NULL DEFAULT 0,
    fuel INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE INDEX fleets_owner ON fleets(owner);

  CREATE TABLE fleet_ships (
    fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (fleet_id, key)
  ) STRICT;

  INSERT INTO fleets (id, owner, from_planet, from_g, from_s, from_p, to_planet,
    to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled)
  SELECT id, owner, from_planet, from_g, from_s, from_p, to_planet,
    to_g, to_s, to_p, mission, cargo_m, cargo_c, cargo_d, dep, arr, ret, state, recalled
  FROM old_fleets;
  INSERT INTO fleet_ships SELECT * FROM old_fleet_ships;
  DROP TABLE old_fleet_ships;
  DROP TABLE old_fleets;
  `;
