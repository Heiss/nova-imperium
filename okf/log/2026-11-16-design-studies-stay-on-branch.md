---
type: log-entry
date: 2026-11-16T15:50
kind: Decision
issues: [244, 243]
---

Design studies stay off `main` (owner, 2026-11-16): mockups under `docs/design/` stay on their branch and open pull request, and the issue links the pictures by branch or commit; #244 merged the study of #243 by mistake, and it stays on `main`; a study's issue carries `idea` and no status label, and a study pull request does not count toward the limit of open pull requests (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
