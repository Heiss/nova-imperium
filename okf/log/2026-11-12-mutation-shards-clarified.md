---
type: log-entry
date: 2026-11-12
kind: Decision
issues: [131]
---

#131 clarified: mutation runs sharded into 4 parallel jobs everywhere, split by mutant count, one incremental cache per job, a gate job merges the reports and checks score and floors as before; proven by one complete sharded run compared with the nightly run; in this release (see [Test strategy](/ops/testing.md)).
