// The migrations of #491. The list may hold more than one; each migration is
// never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261128T1300-score-pass: the newest highscore pass (#405) is stored in
// the database, so a restart of the server shows the same highscore and the
// same „Stand“ and makes the next pass at its scheduled time (owner,
// 2026-11-28, #491). One row at most: the round it was made for (the start
// of the round and the revision of the scores, `roundOf` of
// src/server/game/scores.ts), when it was made, and the pass as JSON (the
// totals and the categories by player). A running round has no row; the
// first reader makes a pass as before.
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261128T1300-score-pass',
    sql: `
    CREATE TABLE score_pass (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      round TEXT NOT NULL,
      at INTEGER NOT NULL,
      pass TEXT NOT NULL
    ) STRICT;
  `,
  },
];

export default migrations;
