---
type: log-entry
date: 2026-11-15T11:57
kind: Decision and code
issues: [213, 216]
---

#213 (owner, 2026-11-15, comment „Geklärt“ on the issue), built: every migration has a fixed ID, a UTC time stamp and a short name such as `20261114T1830-guild-ranks`, and the migrations run in the order of their IDs (D1); the existing migrations got IDs from the UTC commit time of the commit on `main` that added each one, their SQL byte for byte unchanged; a database at `user_version` N counts as having run the first N of them, and the table `schema_migrations` records the IDs from then on (D2); two migrations on the same table run in the order of their IDs, and the upgrade from the last release in CI also checks the recorded IDs (D3); the issue counted 19 migrations, #216 added the 20th before, so all 20 got IDs. The CI job „Migrations append-only“ also refuses a changed ID and a list out of order. Proposals [V]: the strict variant of D3 (a new migration needs an ID after every released one, and a database that ran a newer migration refuses an older one), `user_version` stays the number of migrations run, a checked backup before the table is started, the table holds the ID only, and the upgrade test of a new migration is named by its ID (see [SQLite storage](/data/sqlite.md), [Test strategy](/ops/testing.md)).
