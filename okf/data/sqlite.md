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
databases. Migrations are applied in the order of their IDs in one
transaction; the table `schema_migrations` records the ID of every migration
that ran, and SQLite's `user_version` holds their number, the schema version
(see [Migration IDs](#migration-ids-213)). The caller groups
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

A database only runs the migrations whose IDs it has not recorded. A
removed or changed migration is therefore skipped silently on existing
databases, and a migration whose ID changed would run a second time. A
migration is released when a release tag holds it; once it is on `main` it
does not change either, because databases of `main` (staging, candidates,
development) have run it. Rules, after Flyway and sqlx (checksums of applied
migrations), Atlas (`migrate lint` against the Git base) and GitLab
(committed `structure.sql`):

* **[E]** A schema change is a new migration in its own file (see
  [Migration files](#migration-files-213)); it runs at its place in the
  order of the IDs (see [Migration IDs](#migration-ids-213)). A wrong
  migration is corrected by a further migration, never by an edit.
* **[E]** The CI job "Migrations append-only"
  (`.github/scripts/migrations-gate.mjs`) requires every migration of the
  base commit and of the last release tag to be still there, with the same
  ID and the same SQL byte for byte; a list from before #213 has no IDs and
  is compared by its SQL, as the first migrations in order. The last
  release is the newest CalVer tag of all refs (`git tag --list
  '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname`, version-sorted, so `26.9.3`
  comes before `26.11.22`), not only a tag below `HEAD` (owner,
  2026-11-16); without one the job fails. It requires the list to be in
  strict order of valid IDs, and a migration that is new in the change to
  have an ID after the newest migration of the last release (#213, owner,
  2026-11-16). On a hotfix branch (a push to `hotfix/**` or a pull request
  into one) the release is the tag the branch starts from (`git describe`),
  and every new migration is refused (O19, below). It is part of the CI Gate
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

## Migration IDs (#213)

Decided by the owner on 2026-11-15 (comment „Geklärt“ on #213), so that two
pull requests that each add a migration no longer renumber one of them:

* **[E]** D1: every migration has a fixed ID made of a UTC time stamp and a
  short name, `YYYYMMDDTHHMM-short-name`, for example
  `20261114T1830-guild-ranks`. The migrations run in the order of their IDs.
* **[E]** D2: the existing migrations got fixed IDs. A database at
  `user_version` N counts as having run the first N of them; from then on
  the table `schema_migrations` records the IDs that have run.
* **[E]** D3: when two migrations touch the same table, the order of their
  IDs decides. CI runs the upgrade from the last release with all new
  migrations (`docker/upgrade.sh`, which now also checks that the database
  recorded every ID of the image).
* **[E]** Unchanged: migrations are append-only, a released migration never
  changes (its SQL stayed byte for byte, only the ID was attached; the CI job
  „Migrations append-only“ compared it with `main`), and the upgrade tests
  run on real data.
* **[E]** Strict from the release (owner, 2026-11-16, „Streng ab Release“;
  this replaces the strict variant against `main` that the first pull
  request of #213 proposed as [V]): a new migration ID must sort after the
  newest migration of the last release tag, not after everything on `main`.
  Unreleased migrations may be merged in any order; `MIGRATIONS` stays
  sorted by ID, so a pull request merged later with an older (but
  post-release) ID goes between the unreleased ones, and neither pull
  request changes its ID. Production always upgrades from a release, so it
  runs the migrations in the order of their IDs: every release comes from
  `main`, whose migrations newer than the last release sort after it, and
  a hotfix brings no migration (O19, below), so no release holds a
  migration that `main` sorts before an older unreleased one. Only a database that ran
  `main` in between (staging, development) can run an unreleased migration
  after a newer one; the server runs every migration it has not recorded,
  in the order of the IDs, even when it is older than one it ran. It still
  refuses a database that ran a migration it does not know (a newer
  database) and a list out of order.
* **[E]** O19 „Hotfix ohne Migration“ (owner, 2026-11-16): a hotfix
  brings no migration; schema changes go only through `main` and a normal
  release. The CI job refuses any new migration on a hotfix branch („is new
  on a hotfix branch“). This replaces open point 2 of the first pull
  request (a hotfix migration merged back into `main`): there is none. The
  check of the release applies to the migrations new in a change only
  (neither in the base nor in the release); those of the base were checked
  when they came.
* **[V]** The server runs the migrations in one `BEGIN IMMEDIATE`
  transaction (CodeRabbit on #238): the write lock comes before the record
  is read, so a second process on the same file (a restart while the old
  container still runs) waits for the busy timeout and then finds the
  migrations run, instead of running them again from an old snapshot.
  `migration-ids.test.ts` holds the lock in the middle of a migration while
  a worker thread opens the same file; with a deferred transaction the
  worker fails with „database is locked“.

The code (`src/server/db/database.ts`, `src/server/db/migration-history.ts`,
tests `migration-ids.test.ts` and `migration-history.test.ts`):

* History: the first form of #213 kept `MIGRATIONS` in
  `src/server/db/schema.ts` as a list of `{ id, sql }` in the order of the
  IDs; the migration files below replaced it (owner, 2026-11-16).
  `MIGRATIONS` is still exported from `schema.ts`, read from the folder.
  An ID is checked for its form and for a time that exists
  (`idViolation`); the list must be in strict order, each ID once
  (`orderViolation`, also a property test on random IDs).
* A database without `schema_migrations` gets the table
  (`id TEXT NOT NULL PRIMARY KEY`, `STRICT`) with the IDs of the
  migrations numbered 1 to its `user_version`, in the same transaction as
  the migrations that follow; a failing migration leaves no table behind. A
  database newer than the server is refused before anything changes, as
  before. The 20 migrations from before the IDs carry their old place as
  `number`, because a later migration may sort between them while they are
  unreleased (the last release, 26.11.22, holds 13); D2 counts these
  numbers, not the places in the list.
* `pendingMigrations` returns every migration the database has not
  recorded, in the order of the IDs; it refuses a recorded ID the server
  does not know.
* **[V]** `user_version` keeps the number of migrations run, so the names
  of the backups (`nova.sqlite.v20.bak`), their check and the refusal of a
  newer database by an older image stay as they were.
* **[V]** Starting the table on an existing database changes its schema,
  so the server writes the checked backup first, as before a migration; a
  database of version 20 gets `nova.sqlite.v20.bak`, one of the last
  release (13 migrations) `nova.sqlite.v13.bak` before 14 to 20 run.
* **[V]** `schema_migrations` holds the ID only; nothing asked for the time
  a migration ran.
* **[V]** The upgrade test of a new migration is
  `src/server/db/upgrades/<id>.test.ts` and names its migration by ID
  (`migrationsThrough(id)` in `src/test/migrations.ts`), so it keeps its
  name and its data when another migration sorts before it; the 20
  migrations before the IDs keep `migration-<n>.test.ts`. **[V]** Those name
  their migration by its number (`throughNumber(n)`, `placeOf(n)` in
  `src/test/migrations.ts`) instead of its place in the list
  (`MIGRATIONS.slice(0, n)`), so a new migration that sorts between 14 and
  20 while they are unreleased cannot shift them; what they assert is
  unchanged. `migration-ids.test.ts` proves it with a migration inserted
  between 16 and 17 and checks that no upgrade test uses a place.

The 20 IDs of D2. The time stamp is the UTC commit time of the commit on
`main` that added the migration, cut to the minute: the first-parent history
of `src/server/db/schema.ts` on `main` (`git log --first-parent --reverse
--format='%H %ct' origin/main -- src/server/db/schema.ts`), with the length
of `MIGRATIONS` at each commit; no commit changed a migration that was there
before. The name comes from the comment of the migration or, for 2 to 5,
from the tables it creates. Migrations 7 and 8 came in one commit; their
names sort them in their old order.

| N | ID | Commit |
|---|---|---|
| 1 | `20261106T2104-first-schema` | `e1d7dec` Store the game in SQLite and rebuild the server |
| 2 | `20261107T0911-account-tokens` | `f8feaa6` (#20) |
| 3 | `20261107T0924-guilds` | `3fde4c3` (#24) |
| 4 | `20261107T0945-push` | `8711306` (#26) |
| 5 | `20261107T1403-achievements` | `d2415e5` (#27) |
| 6 | `20261107T1417-admin-audit` | `9d40e57` (#22) |
| 7 | `20261107T1556-announcement-text` | `c5d6f39` (#31) |
| 8 | `20261107T1556-passkeys` | `c5d6f39` (#31) |
| 9 | `20261108T1207-colonization` | `ba04396` (#38) |
| 10 | `20261112T1613-explanation-texts` | `96cb572` (#103) |
| 11 | `20261112T1652-research-planet` | `3c5ea66` (#107) |
| 12 | `20261112T2219-error-log` | `736ca3e` (#128) |
| 13 | `20261113T0006-deploy-mission` | `166dc2c` (#130) |
| 14 | `20261113T1126-planet-fields` | `b146cb5` (#143) |
| 15 | `20261113T2315-places` | `9a85322` (#168) |
| 16 | `20261114T1315-harvest-mission` | `2b9a6bb` (#186) |
| 17 | `20261114T1638-push-kinds` | `d785d0b` (#204) |
| 18 | `20261114T1809-gift-fleet` | `6cc0c4e` (#205) |
| 19 | `20261114T1856-guild-ranks` | `af1f0ec` (#197) |
| 20 | `20261115T0952-guild-chat` | `1f42f1d` (#216) |

The issue counted 19 existing migrations; #216 added migration 20 to `main`
before this was built, so all 20 got IDs.

## Migration files (#213)

Decided by the owner on 2026-11-16 (PR #238): an agent adds a migration
without merge conflicts, the place in a list no longer matters, an ID on
`main` never changes, and the developer or the language model learns it as
early as `pnpm check`.

* **[E]** One migration file per issue:
  `src/server/db/migrations/<issue number>/migrations.ts` exports the ID
  and the SQL of its migrations. The folder is the number of the issue the
  migration is built for. **[V]** The file exports a list,
  `export default [{ id, sql }]`, so an issue that needs two migrations
  keeps one file (`Migration[]` from `migration-files.ts`, a type import
  only).
* **[E]** The 20 migrations from before the IDs are one file each in
  `src/server/db/migrations/legacy/<id>.ts`, exporting `id`, `number` and
  `sql`; their SQL is byte for byte the SQL of `main` (checked by script
  against `origin/main` and against the records of the first form).
* **[E]** The IDs stay those of D1; the migrations run in the order of
  their IDs, whatever folder they are in.
* **[E]** The server reads the folder when it starts, with no committed or
  generated index (`src/server/db/migration-files.ts`, `loadMigrations`;
  `schema.ts` exports `MIGRATIONS` with a top-level `await`, so
  `openDatabase` stays synchronous). It imports every `migrations.ts` and
  every legacy file, sorts by ID, and refuses a stray file or folder
  (anything but `legacy/<id>.ts` and `<issue number>/migrations.ts`, a
  number without a leading zero), a legacy file whose `id` is not its file
  name or that lacks its number or SQL, a file of an issue that is no list
  of `{ id, sql }` (only those two fields are taken, so a new migration has
  no `number`), an ID used twice (naming both files) and an invalid ID. The
  Docker image holds the folder: it copies `src/server` and removes only
  test files.
* **[E]** `node scripts/new-migration.ts <issue> <short-name>` (`pnpm
  new-migration`) prints the ID for a new migration: the current UTC minute
  and the short name, one minute later while that ID is taken. It refuses an
  invalid name and an ID that is not newer than the newest migration of
  the last release tag (the newest CalVer tag of all refs, as in
  `ci.yml`). `--create` writes the skeleton of
  `migrations/<issue>/migrations.ts` and never overwrites one; for a second
  migration of the issue it says to add it to the list.
* **[E]** `pnpm check` runs `pnpm check:migrations`
  (`node .github/scripts/migrations-gate.mjs --local`): the gate of the CI
  job offline against the local `origin/main`. A migration of `main` that
  changed or is gone fails with „Migration <id> is on main and must not
  change any more; change only your own new migration.“ (or „… must not be
  removed or get another ID …“). Without a local `origin/main` it prints a
  warning and passes; the CI job is binding. **[V]** It compares with the
  merge base of `HEAD` and `origin/main` and the newest release tag merged
  into `HEAD`, so a branch that has not taken in a newer `main` is not
  blamed for the migrations it does not have yet. The hotfix rule (O19)
  and the release rule stay as built; the local check runs neither as a
  hotfix.
* **[E]** The CI gate reads the migrations of a commit or tag from the
  folder (`git ls-tree` and `git show` into a temporary copy, read with the
  loader of the server, `scripts/migration-refs.ts`) and still takes the
  older layouts as a base: `MIGRATIONS` as SQL strings in `schema.ts`
  (26.11.22 and older) and as `{ id, sql }` records in `schema.ts` (the
  first form of #213). The migrations of the change come from the working
  tree, through the same loader.
* **[V]** `legacy-migrations.test.ts` imports each of the 20 legacy files
  and pins its ID, number and the SHA-256 of its SQL (taken after the SQL
  was checked against `main`), like the checksums of Flyway. The static
  imports also tie the files to a test for Stryker, which runs only the
  tests related to a mutated file by their imports; the loader's dynamic
  imports do not count.
* **[E]** „Upgrade-Test Pflicht“ (owner, 2026-11-16): every migration of
  `migrations/<issue>/migrations.ts` has its upgrade test
  `src/server/db/upgrades/<id>.test.ts`, which imports its migration file
  statically (so Stryker relates the file to it) and checks the migration
  on real data, as the earlier upgrade tests do. `upgrade-tests.test.ts`
  fails for a migration without it or with a test that does not import
  its file statically (a type import or a dynamic `import()` does not
  count), and says what to add (`upgradeTestViolations` in
  `src/test/migrations.ts`). The 20 legacy migrations keep their tests as
  they are. The migrations folder stays in the mutation tests.
* **[V]** `pnpm new-migration <issue> <name> --create` also writes the
  skeleton of the upgrade test. It imports the migration file, runs the
  migration on a database of the version before and ends in
  `expect.fail('TODO: …')`, so it fails until it is filled in: no test is
  skipped or left empty to make the CI green ([Test strategy](/ops/testing.md)).
  For a second migration of an issue it writes only the test and says to
  add the migration to the list of the file. The script creates both files
  with the flag `wx` (CodeQL on #238, owner, 2026-11-16: no check-then-write
  race), so an existing file is refused in the same step and stays as it
  was.
* Tests: `migration-files.test.ts` (the loader on temporary folders:
  order across folders, stray files and folders, an ID used twice, the
  forms of a legacy file and of a file of an issue), `src/test/new-migration.test.ts`
  (the next ID, a taken minute, the refusal before the release, the
  skeleton the loader reads, a throwaway repository with the three layouts
  and tags `26.9.1`, `26.10.30` and `26.11.2` for the version sort).


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
are stored as integer keys in the existing settings table. So is the guild
switch of #191 (`roundGuilds`, a missing key means on), which needed no
migration (see [Guilds on or off per round](/features/guild-switch.md)).

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

Migration 16 (issue #45, see [Trümmerfelder](/features/debris.md))
rebuilds `fleets` and `fleet_ships` like migration 13 for the mission
`harvest` (Bergung) in the CHECK of `fleets.mission`; a Bergung flies to
the place of a Trümmerfeld (`to_planet` `d<g>_<s>_<p>`), which needs no
column. Fleets in flight keep every column and their ships
(`upgrades/migration-16.test.ts`). The table `debris` of migration 15 is
used from #45 on: one row per position, added up by every battle there.

The moons of #53 need no migration: a moon is a row of `planets` with
`kind = 'moon'` and the id `m<g>_<s>_<p>`, which migration 15 allows, with
its buildings, units and queues in the child tables like a planet; a fleet
to a moon names it in `to_planet` (see [Moons](/features/moons.md)).

Migration 17 (issue #192, see [Push settings per kind](/features/push-settings.md))
adds the table `push_off` (player with `ON DELETE CASCADE`, kind, primary
key over both): one row per push kind a player switched off, so every kind
is on by default. It adds `push_jobs.topic`, the kind of a queued push;
queued pushes of the kinds `buildings`, `research`, `shipyard` and `fleet`
get that kind, queued report pushes (`messages`) get none and are delivered
as before (`upgrades/migration-17.test.ts`).

Migration 18 (issue #161, see [Endzeit](/features/endzeit.md)) adds
`fleets.gift` (`INTEGER NOT NULL DEFAULT 0`, CHECK `0` or `1`): the gift
fleet of the admin's „Endzeit“. Fleets in flight keep every column and get
0 (`upgrades/migration-18.test.ts`). Only a gift writes the column, so a
fleet never stops being a gift and the earlier upgrade tests still save
fleets at their own version.

Migration 19 (issue #163, see [Guild ranks](/features/guild-ranks.md))
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
rank. Other data stay as they were (`upgrades/migration-19.test.ts`:
hand-written data, the constraints and cascades, generated data of
version 18). It was planned as 16 and follows migrations 16 (#45), 17
(#192) and 18 (#161), which reached `main` first.

Migration 20 (issue #169, see [Guild chat](/features/guild-chat.md))
rebuilds `guild_rank_rights` for the three chat rights in the CHECK of
`right_key` (`chat-read`, `chat-write`, `chat-delete`; nothing references
the table, so the rebuild touches no other one), gives every rank below
the Leitung `chat-read` and `chat-write` (owner, 2026-11-15; no rank gets
`chat-delete`, every other right stays) and adds the table `guild_chat`:
`id` (INTEGER PRIMARY KEY AUTOINCREMENT, so ids never come back),
`guild_id` (`ON DELETE CASCADE`), `author` (`REFERENCES users(id) ON
DELETE SET NULL`), `time`, `kind` (`message` or one of the events `join`,
`leave`, `remove`, `rank`, `attack`), `text` (CHECK 1 to 1,000
characters; empty only for `join`, `leave` and `remove`), `member` and
`attacker` (both `REFERENCES users(id) ON DELETE SET NULL`) and `arrival`
(exactly for `attack`); an event has no author, a message no member or
attacker; with indexes on guild, author, member and attacker. It adds
`guild_members.chat_seen` (INTEGER, 0), the newest message of a member's
last visit to the page of its guild (the red mark, owner, 2026-11-15).
Migration 20 is not released yet (2026-11-15), so it was changed in place
for these decisions. Other data stay as they were
(`upgrades/migration-20.test.ts`: hand-written data, the constraints, the
cascade with the guild, anonymisation by account deletion, the new round,
the rules of #163 for existing ranks, generated data of version 19).

Migration `20261116T2211-main-planet` (issue #221, see
[Main planet](/features/main-planet.md)) adds `users.main_planet` (TEXT,
the planet a player chose as the main planet, null for the first planet)
and `users.main_switched` (INTEGER, the time of the last switch, which
starts the lock). Existing players get null in both: their main planet
stays the first planet, unlocked; other data stay as they were
(`upgrades/20261116T2211-main-planet.test.ts`). The upgrade tests of
migrations 11 and 20 run the later migrations before today's code saves a
player, since the player repository writes the new columns.

Migration `20261117T1158-jump-gate` (issue #230, see
[Moons](/features/moons.md)) adds the empty table `jump_gates (moon_id TEXT
PRIMARY KEY REFERENCES planets(id) ON DELETE CASCADE, ready INTEGER NOT
NULL) STRICT`: when the Warp-Tor of a moon is ready again after a jump, so
the cooldown holds after a restart. A moon without a row is ready; the row
goes with its moon (a broken moon of #95, a new round). The planet
repository reads and writes it (`gateReady`, `setGateReady`), never in
`save`, so saving a moon keeps it. Every other table stays as it was
(`upgrades/20261117T1158-jump-gate.test.ts`).

Migration `20261117T0540-position-locks` (issue #224, see
[Abandon a colony](/features/abandon-colony.md)) adds the table
`position_locks` (`g`, `s`, `p` as the primary key, `until` the end of the
lock in milliseconds): a position of a given-up colony, locked for
colonization and new home planets until `until`. A running round has given
up nothing, so the table starts empty; other data stay as they were
(`upgrades/20261117T0540-position-locks.test.ts`). A new round empties it
with the planets (`planets.deleteAll()`); an ended lock stays until then
and no longer counts.

Migration `20261117T0923-activity-times` (issue #229, see
[Activity indicators](/features/activity-indicators.md)) adds
`planets.active_at` (INTEGER, the last activity of a planet or moon, null
without one) and `users.active_at` (INTEGER, the last login or manual
action of an account). The repositories write them apart from a save, so
saving a planet or a player keeps them. Existing planets start without
activity; an existing account starts with its newest `last_seen` of
`player_activity`, null without one, and the server then counts from
`users.created`; other data stay as they were
(`upgrades/20261117T0923-activity-times.test.ts`).
Migration `20261118T2235-missiles` (issue #54, see
[Missiles](/features/missiles.md)) rebuilds `fleets` and `fleet_ships`, as
16 did, for the mission `missile` in the CHECK of `fleets.mission`, and
adds `fleets.aim` (TEXT, the main target of a Raketenangriff, NULL
without one). Every fleet in flight keeps its values, its gift and its
ships; the Raketenkrypta and the missiles are rows of `planet_buildings`
and `planet_units` and need no change
(`upgrades/20261118T2235-missiles.test.ts`). The fleet repository writes
`aim` only for missiles with a main target, so the upgrade tests of
earlier migrations still save fleets.

Migration `20261117T1000-vacation-mode` (issue #223, see
[Vacation mode](/features/vacation-mode.md)) adds `users.vacation`
(INTEGER, when the player's vacation mode started, null outside of it).
Existing players get null: nobody is in vacation mode, the production goes
on and every target stays open; other data stay as they were
(`upgrades/20261117T1000-vacation-mode.test.ts`).

Migration `20261116T2054-moonbreak` (issue #95, in the folder
layout, `migrations/95/migrations.ts`, see [Moons](/features/moons.md))
rebuilds `fleets` and `fleet_ships` like migration 16 for the mission
`moonbreak` (Mondbruch) in the CHECK of `fleets.mission`. Every column
stays, `gift` of migration 18 included (now in the column list with its
CHECK instead of appended), with the index `fleets_owner`, the foreign key
to `users` and both cascades; a Mondbruch flies to a moon (`to_planet`
`m<g>_<s>_<p>`), which needs no column. Its upgrade test
(`upgrades/20261116T2054-moonbreak.test.ts`) writes fleets of the version
before, a gift and fleets from and to a moon among them, checks that every
row and ship stays, that a gift still takes no fleet slot, that a Mondbruch
is saved with its ships, the CHECKs of `mission` and `gift`, the index and
the cascades.
The later migration `20261117T1211-planet-survey` (issue #190) rebuilds
`fleets` again for the mission `survey` and lists `moonbreak` in its CHECK
too, since it runs after this one (its upgrade test checks that both
missions are allowed).

Migration `20261117T0921-demolition` (issue #202, see
[Demolition](/features/demolition.md)) adds `planets.bq_back_m`,
`bq_back_c` and `bq_back_d` (INTEGER), what a demolition of the build
queue gives back at its end; null on an upgrade. Every running order of an
existing round stays an upgrade; other data stay as they were
(`upgrades/20261117T0921-demolition.test.ts`). The upgrade test of
migration 15 copies a planet as a moon in SQL instead of saving it with
today's store, since the planet repository writes the new columns.

Migration `20261118T2230-friendships` (issue #227, see
[Buddy list](/features/buddy-list.md)) adds the table `friendships`:
`requester` and `addressee` (both `REFERENCES users(id) ON DELETE
CASCADE`, primary key together) and `status` (`pending` for an open
request, `friend` once accepted). A check refuses a row of a player with
themselves, and a unique index on the pair in either order
(`friendships_pair`, `min` and `max` of the two) refuses a second or a
crossed row; an index on `addressee` serves the requests to a player. It
stores no time. Existing players start without friends and requests;
other data stay as they were (`upgrades/20261118T2230-friendships.test.ts`).
A new round keeps the table (owner, 2026-11-16, D2).

Account deletion runs in one transaction. Foreign-key cascades clear owned game,
session, reward and push data, and the friendships and requests of the
account in both directions (#227). The deletion also removes led guilds and their
memberships, linked audit and inbox records, invitations for the account address
and active registration challenges. Incoming fleets belonging to other players
turn back. Existing external backups are managed by the operator.

**[E]** Guild chat messages are the exception (owner, 2026-11-14, #169 D7):
deleting an account anonymises its messages instead of deleting them; the
foreign key sets their author to null, and the chat shows them as
„ehemaliges Mitglied“. An event of the chat that names the account (as
the member or the attacker) stays too; the foreign key sets that name to
null. The chat of a guild the account led goes with the guild. Every new
round deletes all chats (D6).

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
  (**[V]** from #213 on `src/server/db/upgrades/<id>.test.ts`, next to
  the migration file `migrations/<issue>/migrations.ts`, see
  [Migration IDs](#migration-ids-213))
  that checks the data after the upgrade. The decision is made by the effect on
  generated data, not by the SQL text; `ALTER TABLE … ADD COLUMN` counts as a
  change. Of the 20 legacy migrations, 7, 9, 10, 11, 13, 14, 15, 16, 17,
  18, 19 and 20 have such tests; the legacy migrations that only create
  tables need none (migration 12 has one anyway, for its CHECK and
  cascade). This exemption holds for the legacy migrations only: from
  2026-11-16 on every new migration has its upgrade test
  `upgrades/<id>.test.ts`, whatever it does („Upgrade-Test Pflicht“, see
  [Migration files](#migration-files-213)).
* **[E]** A self-test proves that the checks find a migration that fails on
  existing data and that the classification tells changes from new tables.
* **[V]** Limits: generated data covers what the constraints allow, not what
  only real players produce; a change that hits no generated row is classified
  as additive; other CHECK forms are only met by chance.

