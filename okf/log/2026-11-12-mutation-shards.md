---
type: log-entry
date: 2026-11-12
kind: Code
issues: [131]
---

#131 built: mutation plan job, 4 shards with their own caches and a gate job on the merged report in the CI and the nightly run (`scripts/mutation-shards.ts`, `mutation-gate.ts --report`); owner decision: display texts are not mutation-tested, the catalog texts moved to `src/shared/texts.ts`, guarded by the catalog, naming and explanation tests (see [Test strategy](/ops/testing.md)).
