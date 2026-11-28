---
type: log-entry
date: 2026-11-27T22:30
kind: Docs
issues: [426]
---

A note on the entry of #426 part 5 (guild rights registry): its words „shown with a right added for the test only“ mean a single local run, in which a right was added by hand and `src/server/db/guild-rights-check.test.ts` failed as intended. No committed test adds a right; the committed test compares the CHECK of the migrated database with `GUILD_RIGHTS` as they are. The entries are of `key`, `order`, `label` and `member`, where that entry says „name“; and only `src/core/guild-ranks.ts` and its tests import `rights.gen.ts`, which a rule of `.dependency-cruiser.cjs` now checks.
