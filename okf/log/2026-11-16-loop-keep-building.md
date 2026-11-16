---
type: log-entry
date: 2026-11-16T17:39
kind: Decision
---

The loop never only waits: while fewer than two subagents build and an issue with `ready` exists that does not depend on the open pull requests, it starts the next one at once, also while it waits on CI or a review (owner, 2026-11-16); label `kein-changelog` (see [Release loop](/ops/loop.md)).
