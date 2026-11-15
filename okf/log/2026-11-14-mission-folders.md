---
type: log-entry
date: 2026-11-14
kind: Code
issues: [116]
---

#116 built, with the owner's decisions of 2026-11-14: every mission is a folder `src/features/missions/<m>/` with `rules.ts` (typed data `order`, `target`, `cargo`, `returns`, `visible`, `silent` and `canSend`, which returns an error code or nothing), `texts.de.ts` (its name, listed as `MISSION_TEXTS`, read through `missionText(m)`) and `arrive.server.ts` (`onArrive`, listed in the generated, not checked-in `src/features/index.server.gen.ts` as `MISSION_SERVERS`, which only `src/server` may import); `src/core/missions.ts` holds `MISSION` and the generic check of the target kind for sending and arrival; `src/core/texts.ts` is gone; the type `Mission` is derived type-only from the index (`no-circular` passes); contract tests for every mission, a unit test per mission, and a property test against the code before on generated worlds and fleets, bit for bit with the same random draws; no change of behaviour (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
