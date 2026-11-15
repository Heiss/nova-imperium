---
type: log-entry
date: 2026-11-12
kind: Update
issues: [127]
---

`src/shared/achievements.ts` has its own test of names, targets and rewards; a complete run after #127 scored it 33.33 %, below its floor 35.18 %; with the test a complete local run scores 100 %. The floor stays 35.18 % until a complete CI run confirms the new score, because incremental runs keep cached results for unchanged mutants (see [Test strategy](/ops/testing.md)).
