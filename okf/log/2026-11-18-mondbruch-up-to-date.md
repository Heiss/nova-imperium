---
type: log-entry
date: 2026-11-18T22:30
kind: Code
issues: [95, 230, 224, 285]
---

#95 brought up to date with `main` (the Warp-Tor of #230, giving up a colony of #224, the Lexicanum of #285, the main planet and the activity times): `destroyMoon` uses the `planets.delete` of #224 instead of an own one; the Mondbruch has an article in the Lexicanum, drafted as [V] from the owner's decisions ([Lexicanum texts](/features/lexicanum-texts.md)); a moon a Mondbruch broke is no start and no target of a jump and takes its gate time along, and a new moon at the same position starts ready (tests in `src/server/game/jump-gate.test.ts`, see [Moons](/features/moons.md)). The migration `20261116T2054-moonbreak` keeps its ID: unreleased migrations may be merged in any order ([SQLite storage](/data/sqlite.md)).
