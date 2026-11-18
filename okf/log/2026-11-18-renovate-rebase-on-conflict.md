---
type: log-entry
date: 2026-11-18T04:25
kind: Decision
issues: [15]
---

Renovate rebases a pull request only on a conflict, and only the updates that merge themselves follow `main` (owner, 2026-11-18): with the default it rebased every open pull request after every push to `main`, 50 of the last 100 CI runs were Renovate's and they kept the runners busy; a major update and a minor one below 1.0 get a pull request only after the owner's tick in the Dependency Dashboard, because a blocked one like TypeScript 7 (#15) ran red for nothing; the loop asks for a rebase with the box „rebase/retry“ before it merges a Renovate pull request, and it merges the green patch and minor ones in every iteration in which none of its own is next, because five green ones had waited since 2026-11-13 (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
