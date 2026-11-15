---
type: log-entry
date: 2026-11-13
kind: Update
issues: [131]
---

#131 proof run (complete, 4 shards): every file score as in the unsharded release run, except `catalog.ts` without the 180 text mutants and two timeouts instead of kills in `settle.ts` (same score); shards 22, 13, 18 and 36 minutes. The weights now come from the last complete run, not an incremental one (owner: improve before the merge; see [Test strategy](/ops/testing.md)).
