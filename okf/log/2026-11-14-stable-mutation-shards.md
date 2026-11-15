---
type: log-entry
date: 2026-11-14
kind: Code
issues: [141]
---

#141 built: stable mutation shards instead of feedback; every file and cut range stays on its shard of the last plan, new ones go onto the lightest shard, and only a shard above 1.5 times the mean gives entries away; every run takes the times of the mutants it ran into the weights, the others keep their old time, no smoothing; the plan and the weights live in the cache `stryker-state-…`, the plan job hands the new state to the gate job as the artifact `mutation-state`; per-mutant noise measured from two `mutation-report` artifacts; tolerance and the source of the previous plan proposed; label `kein-changelog` (see [Test strategy](/ops/testing.md)).
