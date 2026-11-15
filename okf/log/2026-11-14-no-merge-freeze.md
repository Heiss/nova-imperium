---
type: log-entry
date: 2026-11-14
kind: Decision
issues: [149]
---

#149 no merge freeze (owner, 2026-11-13): every merge into `main`, not only a security merge, rebuilds the release pull request and sets it back to draft; the loop keeps running after „Make the release ready“, makes it ready again after each rebuild and tells the owner (the only notice besides the draft state: no comment, no issue), and stops once the owner has merged it; the open release pull request keeps the next cycle from starting (owner, 2026-11-14; first decided with the milestone, which labels replace) (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
