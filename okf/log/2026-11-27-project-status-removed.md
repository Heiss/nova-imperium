---
type: log-entry
date: 2026-11-27T05:00
kind: Decision
---

project status removed (owner, 2026-11-27): the workflow „Project status“ is switched off and removed with `scripts/project-status.ts` and its tests, because the issues with the label `ready` are enough; it had failed 95 times without the secret `PROJECT_TOKEN`. The status labels and their meaning stay (see [Release loop](/ops/loop.md)).
