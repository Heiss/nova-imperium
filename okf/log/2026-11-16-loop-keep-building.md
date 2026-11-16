---
type: log-entry
date: 2026-11-16T17:39
kind: Decision
---

Two subagents always build: when one finishes, the loop starts the next issue with `ready` that does not depend on the open pull requests at once, also while it waits on CI or a review; only the main agent waits and does not build itself, it finishes the open pull requests, cleans up, looks for new issues and pull requests and gets the owner's decisions so that both agents keep building (owner, 2026-11-16); label `kein-changelog` (see [Release loop](/ops/loop.md)).
