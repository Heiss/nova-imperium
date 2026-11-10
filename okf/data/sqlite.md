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

## Released migrations are append-only

A database only runs the migrations above its `user_version`. A moved,
removed or changed migration is therefore skipped silently on existing
databases. Released means merged to `main`, because every green push to
`main` is tagged. Rules, after Flyway and sqlx (checksums of applied
migrations), Atlas (`migrate lint` against the Git base) and GitLab
(committed `structure.sql`):

* **[E]** A schema change is a new entry at the end of `MIGRATIONS`. A wrong
  migration is corrected by a further migration, never by an edit.
* **[E]** The CI job "Migrations append-only"
  (`.github/scripts/migrations-gate.mjs`) requires the migrations of the base
  commit to be an unchanged prefix, byte for byte. It is part of the CI Gate
  for every change, documentation included, and runs again on every push to
  `main`, so a failed run there also stops the automatic tag.
* **[E]** `src/server/db/schema.snapshot.sql` holds the schema after all
  migrations; the unit test fails when it differs. A pull request with a new
  migration updates it, so the review shows the resulting schema.
* **[E]** "Require branches to be up to date before merging" is enabled for
  `main` ([O9](/open-points.md)), so a pull request is checked against the
  current `main` and two pull requests that conflict only in meaning cannot
  both pass against an older `main`.
* **[V]** Not covered: upgrades on real data (new constraints, `INSERT …
  SELECT *` during a table rebuild, cascades on `DROP TABLE` with foreign
  keys on). Only migration 9 has an upgrade test with data.

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
