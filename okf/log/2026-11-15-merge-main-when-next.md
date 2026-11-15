---
type: log-entry
date: 2026-11-15T10:09
kind: Decision
issues: [194]
---

Taking `main` into open pull requests (owner, 2026-11-15): an open pull request takes `main` in only when it is the next one to merge, when GitHub reports a conflict (no CI starts then, as seen on #194) or when it needs code that just landed on `main`, because `main` requires an up-to-date branch and taking `main` in after every merge reran CI on every open pull request (89 of 182 CI runs of the loop's pull requests from 2026-11-12 to 2026-11-15); the limit of open own pull requests is four, not two (owner, 2026-11-15; the bundle still said two) (see [Release loop](/ops/loop.md), [Branching and release](/ops/branching-release.md)).
