---
type: log-entry
date: 2026-11-13
kind: Code
issues: [148]
---

#148 built: Renovate's security pull requests merge themselves for patch and minor updates (`vulnerabilityAlerts.packageRules` in `renovate.json`), `0.x` only for patch, development dependencies alike, pin and digest updates too (validated, not observed), major waits for the owner; a red security pull request is fixed by the release loop in its own `claude/…` pull request outside the limit of two (also in `.claude/loop.md`); proven with a Renovate trace run on the local platform with stubbed alerts (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
