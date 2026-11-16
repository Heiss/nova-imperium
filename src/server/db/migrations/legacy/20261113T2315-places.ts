// Migration 15, numbered by its place before the IDs (#213).
// places (O11, issue #119). A place is coordinates plus a kind; a
// moon will be a row of planets with kind 'moon', so UNIQUE (g, s, p)
// becomes UNIQUE (g, s, p, kind). SQLite needs a rebuild for that. The
// migration runs with foreign_keys = ON, so dropping the old planets would
// delete the rows of its children: they are rebuilt too (as fleets in 9).
// Every planet keeps its id and becomes kind 'planet'. Debris fields get
// their own table, empty until #45.
export const id = '20261113T2315-places';
export const number = 15;
export const sql = `
  ALTER TABLE planet_buildings RENAME TO old_planet_buildings;
  ALTER TABLE planet_units RENAME TO old_planet_units;
  ALTER TABLE planet_production RENAME TO old_planet_production;
  ALTER TABLE shipyard_queue RENAME TO old_shipyard_queue;
  ALTER TABLE planets RENAME TO old_planets;
  DROP INDEX planets_owner;

  CREATE TABLE planets (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    g INTEGER NOT NULL,
    s INTEGER NOT NULL,
    p INTEGER NOT NULL,
    temp INTEGER NOT NULL,
    res_m REAL NOT NULL,
    res_c REAL NOT NULL,
    res_d REAL NOT NULL,
    t INTEGER NOT NULL,
    created INTEGER NOT NULL,
    sq_t INTEGER,
    bq_key TEXT,
    bq_lvl INTEGER,
    bq_start INTEGER,
    bq_end INTEGER,
    bq_cost_m INTEGER,
    bq_cost_c INTEGER,
    bq_cost_d INTEGER,
    diameter INTEGER NOT NULL DEFAULT 0,
    unlimited INTEGER NOT NULL DEFAULT 0 CHECK (unlimited IN (0, 1)),
    kind TEXT NOT NULL DEFAULT 'planet' CHECK (kind IN ('planet', 'moon')),
    UNIQUE (g, s, p, kind)
  ) STRICT;
  CREATE INDEX planets_owner ON planets(owner, created);

  CREATE TABLE planet_buildings (
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    level INTEGER NOT NULL,
    PRIMARY KEY (planet_id, key)
  ) STRICT;

  CREATE TABLE planet_units (
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ship', 'defense')),
    key TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (planet_id, key)
  ) STRICT;

  CREATE TABLE planet_production (
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    pct INTEGER NOT NULL,
    PRIMARY KEY (planet_id, key)
  ) STRICT;

  CREATE TABLE shipyard_queue (
    planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
    pos INTEGER NOT NULL,
    key TEXT NOT NULL,
    n INTEGER NOT NULL,
    unit_ms REAL NOT NULL,
    PRIMARY KEY (planet_id, pos)
  ) STRICT;

  INSERT INTO planets (id, owner, name, g, s, p, temp, res_m, res_c, res_d, t,
    created, sq_t, bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c,
    bq_cost_d, diameter, unlimited)
  SELECT id, owner, name, g, s, p, temp, res_m, res_c, res_d, t,
    created, sq_t, bq_key, bq_lvl, bq_start, bq_end, bq_cost_m, bq_cost_c,
    bq_cost_d, diameter, unlimited
  FROM old_planets;
  INSERT INTO planet_buildings (planet_id, key, level)
    SELECT planet_id, key, level FROM old_planet_buildings;
  INSERT INTO planet_units (planet_id, kind, key, count)
    SELECT planet_id, kind, key, count FROM old_planet_units;
  INSERT INTO planet_production (planet_id, key, pct)
    SELECT planet_id, key, pct FROM old_planet_production;
  INSERT INTO shipyard_queue (planet_id, pos, key, n, unit_ms)
    SELECT planet_id, pos, key, n, unit_ms FROM old_shipyard_queue;
  DROP TABLE old_shipyard_queue;
  DROP TABLE old_planet_production;
  DROP TABLE old_planet_units;
  DROP TABLE old_planet_buildings;
  DROP TABLE old_planets;

  CREATE TABLE debris (
    id TEXT PRIMARY KEY,
    g INTEGER NOT NULL,
    s INTEGER NOT NULL,
    p INTEGER NOT NULL,
    res_m REAL NOT NULL,
    res_c REAL NOT NULL,
    UNIQUE (g, s, p)
  ) STRICT;
  `;
