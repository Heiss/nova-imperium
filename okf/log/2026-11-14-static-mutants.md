---
type: log-entry
date: 2026-11-14
kind: Code
issues: [201]
---

#201 built: static mutants always run again (owner, 2026-11-14); before the incremental run of each shard the step „Static mutants run again“ (`scripts/mutation-shards.ts drop-static`) removes every mutant with `static: true` from the shard's incremental file, every other result stays cached; the release pull request and the nightly run stay `--force`; shown locally on `guilds.ts`: a new test that kills the static `linkify: true` was ignored by an incremental run before the step and counted after it; cost measured on the nightly run of 2026-11-14: 1031 of 6069 mutants are static, 158 of 252 mutant-minutes; label `kein-changelog` (see [Test strategy](/ops/testing.md)).
