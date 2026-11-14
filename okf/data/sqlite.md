---
type: Concept
title: SQLite storage
description: Database schema, migrations, transactions, and backups.
---

# SQLite storage

The server stores game state and accounts in `nova.sqlite` in the configured
data directory. The schema covers accounts, sessions and invitations, planets
(and later moons), debris fields, fleets, reports, universe settings, account
security tokens, suspensions and audit data.

On startup, the database enables foreign keys and uses WAL mode for on-disk
databases. Migrations are applied in order in a transaction, with the current
schema version recorded in SQLite's `user_version`. The caller groups
related updates in a transaction (`ctx.tx`); a repository never opens one
(#117, see [Design patterns](/architecture/patterns.md)). Write transactions acquire the writer lock
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

Migration 11 stores the planet where the running research started
(`users.rq_planet`, issue #49), so a cancel refunds that planet. Research
started before has no planet and is refunded to the home planet
(`upgrades/migration-11.test.ts`).

Migration 12 adds the error log of issue #126, table `error_events`: kind
(`server`, `client`, `report`, CHECK), time of the last and `first`
occurrence, player (`ON DELETE CASCADE`), request ID, action, page, version,
browser, message, detail (stack), count of merged browser errors and the
report text; indexes on the time and on player, kind and time. The hourly
sweep deletes rows older than 30 days together with the audit log. Only a
new table: existing data stay as they were (`upgrades/migration-12.test.ts`,
which also checks the CHECK and the cascade). See
[Error log and problem reports](/features/error-log.md).

Migration 13 rebuilds `fleets` and `fleet_ships` (like migration 9) for the
deploy mission `deploy` in the CHECK and adds `fleets.fuel`, the fuel a
fleet burnt at the start (`INTEGER NOT NULL DEFAULT 0`; issue #129, see
[Deploy mission](/features/deploy.md)). Fleets in flight keep their data and
ships and get 0 (`upgrades/migration-13.test.ts`).

Migration 14 adds the diameter and the field limit of a planet (issue #51,
see [Planet fields](/features/fields.md)): `planets.diameter` (km, `INTEGER
NOT NULL DEFAULT 0`) and `planets.unlimited` (`0` or `1`, CHECK, `NOT NULL
DEFAULT 0`). Every planet that exists at the upgrade gets `unlimited = 1`,
no field limit until the next round; the home planet (the oldest planet of
its owner) gets 12,800 km, a colony a diameter drawn with `random()` from
the field range of its position (16 and above like 15). Other data stay as
they were (`upgrades/migration-14.test.ts`).

Migration 15 (issue #119, O11, see [Design patterns](/architecture/patterns.md))
stores places as coordinates plus a kind. It rebuilds `planets` with
`kind` (`TEXT NOT NULL DEFAULT 'planet'`, CHECK `planet` or `moon`) and
`UNIQUE (g, s, p, kind)` instead of `UNIQUE (g, s, p)`, so a moon can later
share the coordinates of its planet. Migrations run with `foreign_keys = ON`:
dropping the old `planets` would delete the rows of its children, so the
migration renames and rebuilds `planet_buildings`, `planet_units`,
`planet_production` and `shipyard_queue` with it (like `fleets` in
migration 9) and recreates `planets_owner`. Every planet keeps its id and
becomes kind `planet`; fleets, research and push jobs hold planet ids and
stay as they were. It also adds the empty table `debris` (id `d<g>_<s>_<p>`,
coordinates, `res_m` and `res_c` as REAL, `UNIQUE (g, s, p)`) for the
debris fields of #45. `upgrades/migration-15.test.ts` checks hand-written
data, the cascade and the new constraints, and on generated data of version
14 that every table keeps its rows.

Migration 16 (issue #163, see [Guild ranks](/features/guild-ranks.md))
adds the guild ranks: table `guild_ranks` (id, `guild_id` with `ON DELETE
CASCADE`, name, `position` with `UNIQUE (guild_id, position)`; 0 is the
Leitung, a larger number a lower rank), table `guild_rank_rights`
(`rank_id` with `ON DELETE CASCADE`, `right_key` with a CHECK of the five
rights, primary key of both), `guilds.default_rank` and
`guild_members.rank_id` (both `REFERENCES guild_ranks(id)`, so a rank that
is a default or held by a member cannot be deleted by mistake) and the
index `guild_members_rank`. Every guild gets the ranks `r0_<id>` „Leitung“
(position 0) and `r1_<id>` „Mitglied“ (position 1, its default rank); the
founder gets the Leitung, every other member „Mitglied“, an applicant no
rank. Other data stay as they were (`upgrades/migration-16.test.ts`:
hand-written data, the constraints and cascades, generated data of
version 15). The number is the next free one on `main`; other branches
plan 16 and 17 (#45, #161, #53), so the order is settled at merge time.

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
  change. Migrations 7, 9, 10, 11, 13, 14, 15 and 16 have such tests; pure `CREATE` migrations need
  none (migration 12 has one anyway, for its CHECK and cascade).
* **[E]** A self-test proves that the checks find a migration that fails on
  existing data and that the classification tells changes from new tables.
* **[V]** Limits: generated data covers what the constraints allow, not what
  only real players produce; a change that hits no generated row is classified
  as additive; other CHECK forms are only met by chance.

