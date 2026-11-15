---
type: log-entry
date: 2026-11-12
kind: Decision
---

Trivy in the CI blocks High holes with a fix in release pull requests and for `hotfix/**`; other pull requests block only on the Critical holes they bring in (compared with the base branch image), so Renovate pull requests do not block each other; the hourly scan rates npm holes by the higher of GHSA and Trivy (see [Branching and release](/ops/branching-release.md), [Test strategy](/ops/testing.md)).
