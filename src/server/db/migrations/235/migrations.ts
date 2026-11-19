// The migrations of #235. The list may hold more than one; each
// migration is never changed once it is on main and has its upgrade test
// src/server/db/upgrades/<id>.test.ts.
//
// 20261120T0900-round-archive: the archive of the rounds (#235, owner,
// 2026-11-16 and „Geklärt“ 2026-11-17). `rounds` holds the identity and the
// lifecycle of a round: its number, whether it runs or is closed, the start,
// the cutoff of the close and the rules it ran under. `round_participants`
// links an account to the rounds it played; the trigger on the deletion of
// an account (whatever deletes it) cuts the link and gives the seat the
// pseudonym „Gelöschter Spieler“, its numbers stay (D4, [V] wording). `round_events` is the one
// durable event history of a round, written in the same transaction as the
// facts it records and kept until the admin deletes that round (Lifetime);
// no purge of the audit log touches it, and it holds no separately stored
// totals or chart samples. A round that runs at the migration gets its row
// with the coverage „partial“ (the history before the archive is missing, no
// backfill) and no stored rules; a universe without a planet starts with
// the coverage „complete“ ([V]).
import type { Migration } from '../../migration-files.ts';

const migrations: Migration[] = [
  {
    id: '20261120T0900-round-archive',
    sql: `
    CREATE TABLE rounds (
      number INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
      started INTEGER NOT NULL,
      closed INTEGER,
      coverage TEXT NOT NULL CHECK (coverage IN ('complete', 'partial')),
      rules TEXT NOT NULL,
      events INTEGER
    ) STRICT;
    CREATE TABLE round_participants (
      round INTEGER NOT NULL REFERENCES rounds(number) ON DELETE CASCADE,
      seat INTEGER NOT NULL,
      player TEXT,
      name TEXT NOT NULL,
      PRIMARY KEY (round, seat)
    ) STRICT;
    CREATE INDEX round_participants_player ON round_participants(player)
      WHERE player IS NOT NULL;
    CREATE TABLE round_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round INTEGER NOT NULL REFERENCES rounds(number) ON DELETE CASCADE,
      at INTEGER NOT NULL,
      recorded INTEGER NOT NULL,
      kind TEXT NOT NULL,
      seat INTEGER,
      version INTEGER NOT NULL,
      payload TEXT NOT NULL
    ) STRICT;
    CREATE INDEX round_events_kind ON round_events(round, kind, at);
    CREATE TRIGGER round_participants_deleted_account BEFORE DELETE ON users
    BEGIN
      UPDATE round_participants SET player = NULL, name = 'Gelöschter Spieler'
      WHERE player = OLD.id;
    END;
    INSERT INTO rounds (number, status, started, closed, coverage, rules, events)
    SELECT
      COALESCE((SELECT value FROM settings WHERE key = 'round'), 1),
      'active',
      COALESCE(
        (SELECT value FROM settings WHERE key = 'roundStart'),
        (SELECT MIN(created) FROM planets),
        CAST(strftime('%s', 'now') AS INTEGER) * 1000
      ),
      NULL,
      CASE WHEN EXISTS (SELECT 1 FROM planets) THEN 'partial' ELSE 'complete' END,
      '{}',
      NULL;
  `,
  },
];

export default migrations;
