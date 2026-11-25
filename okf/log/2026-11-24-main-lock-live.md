---
type: log-entry
date: 2026-11-24T15:30
kind: Feature
issues: [366]
---

The lock after a switch of the main planet can be set during the round (#366; owner, 2026-11-22): `roundMainLock` is a live setting, a row of „Universum“ under „Hauptplanet“, and „Neue Runde“ still offers it. A change counts only for later switches: the end of a lock is stored at the switch (`users.main_lock_end`, migration `20261124T1114-main-lock-end`, which gives every existing lock the end it had by the rule before [V]), and a lock that has already ended stays ended [V]. Tests: the upgrade test of the migration, a lock running at the change, one already over and a switch after the change (`src/server/game/main-planet.test.ts`), and the admin's change in „Universum“ with „Neue Runde“ (`e2e/main-planet.spec.ts`, failed without the live flag). Changed existing tests: the registry case of `src/core/main-planet.test.ts` (now live, by the owner's decision), the cases of `mainOf` there (the stored end instead of the switch and the days), and the headings of „Universum“ in `e2e/admin-groups.spec.ts` (with „Hauptplanet“).
