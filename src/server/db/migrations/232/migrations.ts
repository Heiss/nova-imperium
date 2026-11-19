// The migrations of #232. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261119T1815-playtime-events: the accepted intervals of the estimated
// active play time (#232, okf/features/own-activity.md). One row per
// accepted report of a browser page, append only: the totals of a day, a
// round or an account are derived from these rows on read, none is stored.
// A row keeps the round (its number), the usage session of the player
// (counting from 1, a new one after a pause of 30 minutes or a new round),
// the page (`instance`) and its `seq`, the state the page moved to, the
// reason, the interval on the server's clock (`start_ms`, `end_ms`) and the
// version of the method. A row goes with its account; the 30-day purge of
// the audit log does not touch it, since the rows are kept until the admin
// deletes the round (#235). The old `player_activity` sums stay as they are
// and are not decomposed.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261119T1815-playtime-events',
    sql: `
    CREATE TABLE playtime_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      play_session INTEGER NOT NULL,
      instance TEXT NOT NULL,
      seq INTEGER NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('active', 'inactive', 'background')),
      reason TEXT NOT NULL CHECK (reason IN ('start', 'heartbeat', 'idle', 'background')),
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      method INTEGER NOT NULL,
      UNIQUE (user_id, instance, seq)
    ) STRICT;
    CREATE INDEX playtime_events_user_start ON playtime_events (user_id, start_ms);
    CREATE INDEX playtime_events_round ON playtime_events (round, user_id);
  `,
  },
];

export default migrations;
