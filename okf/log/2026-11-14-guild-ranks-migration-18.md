---
type: log-entry
date: 2026-11-14
kind: Code
issues: [163, 192]
---

#163 merged with `main` after #192: the guild ranks migration is now 18, after migration 17 of #192 (`push_off`, `push_jobs.topic`); its upgrade test is `upgrades/migration-18.test.ts` and starts from version 17. The guild ranks send no push and no report, so the push kinds of #192 need no change (see [SQLite storage](/data/sqlite.md), [Guild ranks](/features/guild-ranks.md)).
