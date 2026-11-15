---
type: log-entry
date: 2026-11-14
kind: Code
---

project status (owner, 2026-11-14): the workflow „Project status“ (`.github/workflows/project-status.yml`, `scripts/project-status.ts`) sets the field „Status“ of the owner's project 5 from the status labels; the label added last holds and the others are removed, no status label is „Backlog“, closed issues are left to „Item closed“, the project's „Auto-add“ adds the issues, a manual run syncs every open issue; needs the secret `PROJECT_TOKEN` (classic, scope `project`) and the variable `PROJECT_NUMBER`; tests with a fake GraphQL API (see [Release loop](/ops/loop.md)).
