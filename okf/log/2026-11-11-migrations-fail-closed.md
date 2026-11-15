---
type: log-entry
date: 2026-11-11
kind: Update
---

Migrations fail closed: the backup is checked before a migration, without a good backup the server does not start; tested with real data per version, as a process and as a Docker upgrade from the last release (see [SQLite storage](/data/sqlite.md)).
