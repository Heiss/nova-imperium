---
type: log-entry
date: 2026-11-16T15:08
kind: Decision
issues: [212]
---

At most two subagents build at the same time, while up to four own pull requests stay open (owner, 2026-11-16): a building agent costs memory and usage, a waiting pull request little; merge conflicts are no longer the reason, since most were in `okf/log.md` before #212 (see [Release loop](/ops/loop.md)).
