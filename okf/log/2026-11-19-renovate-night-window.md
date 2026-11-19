---
type: log-entry
date: 2026-11-19T08:30
kind: Decision and code
issues: [311, 315]
---

Renovate merges its ordinary patch updates only at night, from 02:00 to 04:59 UTC, and merges them itself instead of through GitHub's auto-merge, which knows no time window; security updates still merge at any time. Two patch updates (#311, #315) had each put four open pull requests behind main during the day, and each of those then needed a new run of the CI (owner, 2026-11-19, see [Branching and release](/ops/branching-release.md)).
