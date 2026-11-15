---
type: log-entry
date: 2026-11-15T10:09
kind: Decision
issues: [194]
---

Taking `main` into open pull requests, local checks and usage (owner, 2026-11-15): an open pull request takes `main` in only when it is the next one to merge, when GitHub reports a conflict (no CI starts then, as seen on #194) or when it needs code that just landed on `main`, because `main` requires an up-to-date branch and taking `main` in after every merge reran CI on every open pull request (89 of 182 CI runs of the loop's pull requests from 2026-11-12 to 2026-11-15); the limit of open own pull requests is four, not two (owner, 2026-11-15; the bundle still said two); `pnpm check` and E2E run locally only before the push that precedes „ready“ and after a merge of `main` with a conflict in code; the loop saves usage: no tool call for events that need nothing, large output only through a subagent or `grep`, no polling with one fallback wakeup of about 50 minutes, and once a day the weekly usage it can see in the log entry of its next pull request (see [Release loop](/ops/loop.md), [Branching and release](/ops/branching-release.md)).
