---
type: log-entry
date: 2026-11-19T14:00
kind: Fix
issues: [309, 281, 318]
---

#309 follow-up: a pull request with many changed files was slower in the partial run than in the 6 shards, because the one job has no cache and no parallel jobs: the partial run of #281 (11 files) took 9 minutes, that of #318 (33 files) more than 60 minutes without an end, the complete run about 60. A partial set of more than 12 files (`PARTIAL_LIMIT` in `scripts/mutation-partial.ts`, a count after the sources of tests and the files of floor changes are added) now gives the complete run in 6 shards through the same decision as a change of the configuration, with the reason on stderr. A limit by weight would need the weights of the last complete run, which are in a cache and not in the repository; it is not built (coordinator, see [Test strategy](/ops/testing.md)).
