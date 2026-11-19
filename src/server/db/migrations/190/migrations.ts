// The migrations of #190. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261119T0811-planet-survey: the mission Vermessung and its reports
// (#190). The CHECK of fleets.mission and of reports.type needs a rebuild of
// fleets, fleet_ships and reports, as in migration 16; every row keeps its
// values. The table surveys holds the values of a free position from its
// first survey (D1): its temperature and diameter, and when it was surveyed,
// so that they are deleted after 30 days if nobody colonized it. It runs
// after 20261119T0744-holding (#55) and the Mondbruch rebuild of fleets
// (20261119T0810-moonbreak): its fleets keep the column `hold` and the state
// 'hold' of the holding.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261119T0811-planet-survey',
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
    mission TEXT NOT NULL CHECK (mission IN ('attack', 'transport', 'spy', 'colonize', 'deploy', 'harvest', 'hold', 'moonbreak', 'survey')),
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

  ALTER TABLE reports RENAME TO old_reports;
  DROP INDEX reports_user;
  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'spy', 'battle', 'survey')),
    title TEXT NOT NULL,
    body TEXT NOT NULL
  ) STRICT;
  CREATE INDEX reports_user ON reports(user_id, seq);
  INSERT INTO reports (id, user_id, time, seq, type, title, body)
    SELECT id, user_id, time, seq, type, title, body FROM old_reports;
  DROP TABLE old_reports;

  CREATE TABLE surveys (
    id TEXT PRIMARY KEY,
    g INTEGER NOT NULL,
    s INTEGER NOT NULL,
    p INTEGER NOT NULL,
    temp INTEGER NOT NULL,
    diameter INTEGER NOT NULL,
    created INTEGER NOT NULL,
    UNIQUE (g, s, p)
  ) STRICT;
  CREATE INDEX surveys_created ON surveys(created);
  `,
  },
];

export default migrations;
