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
  `
  CREATE TABLE guilds (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    description TEXT NOT NULL,
    founder TEXT NOT NULL REFERENCES users(id)
  ) STRICT;
  CREATE TABLE guild_members (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'member'))
  ) STRICT;
  CREATE INDEX guild_members_guild ON guild_members(guild_id, status);
  `,
  `
  CREATE TABLE push_keys (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL
  ) STRICT;
  CREATE TABLE push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL
  ) STRICT;
  CREATE INDEX push_subscription_user ON push_subscriptions(user_id);
  CREATE TABLE push_jobs (
    endpoint TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    event_key TEXT NOT NULL,
    due REAL NOT NULL,
    retry_at REAL NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (endpoint, kind, event_key)
  ) STRICT;
  CREATE INDEX push_due ON push_jobs(retry_at);
  `,
  `
  CREATE TABLE achievement_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (user_id, metric)
  ) STRICT;
  CREATE TABLE achievement_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  ) STRICT;
  CREATE TABLE daily_rewards (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_day INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    claimed_day INTEGER
  ) STRICT;
  `,
  // 6: admin audit, activity estimates and account suspensions
  `
  CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time INTEGER NOT NULL,
    actor TEXT,
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    target TEXT,
    request_id TEXT,
    detail TEXT NOT NULL
  ) STRICT;
  CREATE INDEX audit_time ON audit_events(time);
  CREATE INDEX audit_actor ON audit_events(actor, id);
  CREATE INDEX audit_target ON audit_events(target, id);

  CREATE TABLE player_activity (
    player TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    active_ms INTEGER NOT NULL,
    PRIMARY KEY (player, day)
  ) STRICT;

  CREATE TABLE suspensions (
    player TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    until INTEGER
  ) STRICT;
  `,
  // 7: retain announcement text until push delivery
  `
  ALTER TABLE push_jobs ADD COLUMN body TEXT;
  `,
  // 8: passkey credentials and short-lived WebAuthn challenges
  `
  CREATE TABLE passkeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL,
    created INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX passkeys_owner ON passkeys(user_id);
  CREATE TABLE passkey_challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    session_hash TEXT,
    expires INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX passkey_challenges_expiry ON passkey_challenges(expires);
  `,
  // 9: allow colonization and preserve existing fleets and ships
  `
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
    mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize')),
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

  INSERT INTO fleets SELECT * FROM old_fleets;
  INSERT INTO fleet_ships SELECT * FROM old_fleet_ships;
  DROP TABLE old_fleet_ships;
  DROP TABLE old_fleets;

  WITH home AS (
    SELECT s.endpoint, (
      SELECT p.id FROM planets p WHERE p.owner = s.user_id ORDER BY p.created, p.id LIMIT 1
    ) AS planet
    FROM push_subscriptions s
  )
  UPDATE push_jobs
  SET event_key = home.planet || ':' || event_key
  FROM home
  WHERE push_jobs.endpoint = home.endpoint AND home.planet IS NOT NULL
    AND kind IN ('buildings', 'shipyard');
  `,
];
