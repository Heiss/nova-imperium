---
type: Concept
title: SQLite storage
description: Database schema, migrations, transactions, and backups.
---

# SQLite storage

The server stores game state and accounts in `nova.sqlite` in the configured
data directory. The schema covers accounts, sessions and invitations, planets,
fleets, reports, universe settings, account security tokens, suspensions and
audit data.

On startup, the database enables foreign keys and uses WAL mode for on-disk
databases. Migrations are applied in order in a transaction, with the current
schema version recorded in SQLite's `user_version`. Store operations can group
related updates in a transaction. Write transactions acquire the writer lock
before reading, so competing writers use the configured busy timeout instead
of invalidating a snapshot midway through an action. The client retries a
game action once when the server explicitly reports that it rolled back due
to contention. Fleet arrivals remain queued when the writer lock is busy.

**[E]** Before migrations run on an existing database file, the server writes
`VACUUM INTO` a consistent copy with the old schema version next to it
(`nova.sqlite.v<version>.bak`) and keeps the newest three (owner decision,
2026-11-10). A new database and `:memory:` get no copy. A failing migration
rolls back in its transaction; the server then stops with an error that names
the backup and the manual restore (overwrite the file, delete `-wal` and
`-shm`). Code: `src/server/db/database.ts`, tests `database.test.ts`.

In Docker Compose, the named data volume persists the database across container
replacements. Follow the [backup and restore procedure](../../docs/operations.md#backup-and-restore)
before upgrades.


## Admin data

Migration 6 adds these tables:

| Table | Data |
| --- | --- |
| `audit_events` | Chronological audit entries with an actor, action, outcome, target, request ID and operation-specific metadata. |
| `player_activity` | Last observed interaction and estimated active milliseconds per player and UTC day. |
| `suspensions` | Player suspension reason and optional expiration. |

Successful audited changes and their entries commit together. Rejected or
failed changes can leave an audit entry after the game-state transaction rolls
back. The hourly sweep removes events and activity data older than 30 days.
Backups of the SQLite database include the data present at backup time.

See [Admin](/features/admin.md) for the access rules and measurement method.

Migration 7 adds an optional text body to queued push notifications, so server
announcements keep their text until delivery. Round number and reward switches
are stored as integer keys in the existing settings table.

Migration 8 stores passkey public keys and counters, and short-lived single-use
WebAuthn challenges. Registration challenges are bound to the authenticated
session. Account recovery removes previously registered passkeys.

Account deletion runs in one transaction. Foreign-key cascades clear owned game,
session, reward and push data. The deletion also removes led guilds and their
memberships, linked audit and inbox records, invitations for the account address
and active registration challenges. Incoming fleets belonging to other players
turn back. Existing external backups are managed by the operator.

## Upgrade tests on generated data

A migration must work on every database the previous version could have
written, not only on an empty one (owner decision, 2026-11-10: property-based
tests together with an own test for each changing migration).

* **[E]** `src/test/migrations.ts` derives a generator of valid data from the
  schema of any version: column types (`STRICT`), `NOT NULL`, foreign keys and
  the CHECK forms `x IN (...)` and `x = n`. Values are chosen to collide
  (`NOCASE` names, empty strings, Unicode, number limits). Rows that SQLite
  rejects are skipped, so every generated database is a possible one.
* **[E]** `src/server/db/migrations.property.test.ts` runs each migration on
  such databases (fast-check). It must not fail, and `integrity_check` and
  `foreign_key_check` must be clean afterwards. Pull requests: 100 databases
  per migration, fixed seed. Nightly (`migrations-nightly.yml`): 1000 with a
  random seed; a failure prints the seed to reproduce with `MIGRATION_SEED`.
  Stryker uses 10 runs (`MIGRATION_RUNS`).
* **[E]** A migration that changes or removes an existing schema entry or
  existing rows needs its own test `src/server/db/upgrades/migration-<n>.test.ts`
  that checks the data after the upgrade. The decision is made by the effect on
  generated data, not by the SQL text; `ALTER TABLE … ADD COLUMN` counts as a
  change. Migrations 7 and 9 have such tests; pure `CREATE` migrations need
  none.
* **[E]** A self-test proves that the checks find a migration that fails on
  existing data and that the classification tells changes from new tables.
* **[V]** Limits: generated data covers what the constraints allow, not what
  only real players produce; a change that hits no generated row is classified
  as additive; other CHECK forms are only met by chance.

