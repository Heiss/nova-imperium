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
rolls back in its transaction; the server then stays in maintenance with an
error that names the backup and the manual restore (overwrite the file, delete `-wal` and
`-shm`). Code: `src/server/db/database.ts`, tests `database.test.ts`.

**[E]** Fail closed (owner, 2026-11-11: „lieber startet es nicht“): the copy
is checked before the migration runs (`verifyBackup`: `integrity_check`,
schema version, rows per table). If it cannot be written or fails the check,
the server does not migrate and the database stays as it was. The server does
not start the game: it stays in maintenance (issue #80, see below).
Tested at three levels:

* `database.test.ts`: a copy that cannot be written, a copy that fails the
  check, the check itself, and for every released version generated data
  (`src/test/migrations.ts`) that the backup holds unchanged and that the
  documented restore gives back unchanged.
* `src/server/start.test.ts`: the real server process logs the message, stays
  in maintenance (503 „Wartung“, health check 503, no exit) when the copy
  fails, and the database file is byte for byte the same.
* CI job „Docker image and Compose stack“ (`docker/upgrade.sh`): the last
  release (`ghcr.io/heiss/nova-imperium:latest`) writes a player, then the
  image under test starts on the same volume; the player and the admin right
  survive, and a migration leaves the backup of the old schema version.

**[E]** Maintenance (owner, 2026-11-11, issue #80): the server listens at once
and runs backup and migration in a worker thread
(`src/server/db/migrate-worker.ts`); meanwhile every request gets 503
„Wartung“ (`src/server/maintenance.ts`). After a refused migration it stays in
the state „stopped“ instead of exiting: 503, health check 503, the database
is never opened, no restart loop, back after a reboot (`restart:
unless-stopped`; `on-failure:N` was rejected because Docker does not restart
it after a reboot). The operator switches planned maintenance with
`nova maintenance on|off|status` (a file in the data volume, works without
the database). When the game does not answer at all, Caddy shows
`docker/maintenance.html` (`handle_errors 502 503 504`) and starts without a
healthy game. The client shows a banner and checks `/healthz` every 15 s.
Tests: `src/server/maintenance.test.ts`, `src/server/start.test.ts`,
`src/client/logic/maintenance.test.ts`, `docker/smoke.sh` in CI.

In Docker Compose, the named data volume persists the database across container
replacements. Follow the [backup and restore procedure](../../docs/operations.md#backup-and-restore)
before upgrades.

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
* **[E]** Upgrades on data are tested on generated databases; see
  [Upgrade tests on generated data](#upgrade-tests-on-generated-data).


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

Migration 10 adds the display option of the explanation texts per player,
`users.explain_mode` (`always`, `icon` or `hidden`, CHECK, `NOT NULL DEFAULT
'icon'`; issue #63, see [Explanation texts](/features/explanation-texts.md)).
Existing players get „(?)-Symbol“; their other data stay as they were
(`upgrades/migration-10.test.ts`).

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
  change. Migrations 7, 9 and 10 have such tests; pure `CREATE` migrations need
  none.
* **[E]** A self-test proves that the checks find a migration that fails on
  existing data and that the classification tells changes from new tables.
* **[V]** Limits: generated data covers what the constraints allow, not what
  only real players produce; a change that hits no generated row is classified
  as additive; other CHECK forms are only met by chance.

