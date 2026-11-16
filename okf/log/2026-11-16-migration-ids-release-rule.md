---
type: log-entry
date: 2026-11-16T11:48
kind: Decision and code
issues: [213]
---

#213, owner, 2026-11-16 („Streng ab Release“), built in the same pull request: a new migration ID must sort after the newest migration of the last release tag, not after everything on `main`, so unreleased migrations merge in any order and neither pull request changes its ID; `MIGRATIONS` stays sorted by ID. The server runs every migration a database has not recorded, in the order of the IDs, even one older than a migration it ran (only a database of `main` sees that, a release upgrades in order); it still refuses an unknown recorded ID and a list out of order. The CI job „Migrations append-only“ compares with the base and with the last release tag: every migration stays with its ID and SQL, and a new one is newer than the release. This replaces the strict variant against `main` of the first pull request [V], and a hotfix migration merged back into `main` now passes. The 20 migrations from before the IDs carry their old place as `number`, which D2 counts, because a new migration may sort between them while they are unreleased; their upgrade tests name them by that number instead of their place in the list [V], so such a migration cannot shift them (see [SQLite storage](/data/sqlite.md), [Test strategy](/ops/testing.md)).
