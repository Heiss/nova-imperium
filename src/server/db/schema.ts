// Versioned migrations of the SQLite database. A migration is never changed
// after it was released; a change of the schema is a new entry at the end.

export const MIGRATIONS: readonly string[] = [
  // 1: the first schema
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT COLLATE NOCASE UNIQUE,
    salt TEXT NOT NULL,
    pw_hash TEXT NOT NULL,
    admin INTEGER NOT NULL DEFAULT 0 CHECK (admin IN (0, 1)),
    probes INTEGER NOT NULL DEFAULT 1,
    read_at INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL,
    rq_key TEXT,
    rq_lvl INTEGER,
    rq_start INTEGER,
    rq_end INTEGER,
    rq_cost_m INTEGER,
    rq_cost_c INTEGER,
    rq_cost_d INTEGER
  ) STRICT;

  CREATE TABLE user_research (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    level INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  ) STRICT;

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
    UNIQUE (g, s, p)
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
    mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy')),
    cargo_m REAL NOT NULL,
    cargo_c REAL NOT NULL,
    cargo_d REAL NOT NULL,
    dep INTEGER NOT NULL,
    arr INTEGER NOT NULL,
    ret INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('out', 'back')),
    recalled INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE INDEX fleets_owner ON fleets(owner);

  CREATE TABLE fleet_ships (
    fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (fleet_id, key)
  ) STRICT;

  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'spy', 'battle')),
    title TEXT NOT NULL,
    body TEXT NOT NULL
  ) STRICT;
  CREATE INDEX reports_user ON reports(user_id, seq);

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL,
    used_at INTEGER,
    revoked_at INTEGER
  ) STRICT;
  CREATE INDEX invitations_email ON invitations(email);
  `,
  `
  CREATE TABLE account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('reset', 'login')),
    code_hash TEXT,
    expires INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  ) STRICT;
  CREATE UNIQUE INDEX account_login_user ON account_tokens(user_id) WHERE purpose = 'login';
  CREATE INDEX account_tokens_user ON account_tokens(user_id, purpose, expires);
  CREATE INDEX account_tokens_expiry ON account_tokens(expires);
  `,
];
