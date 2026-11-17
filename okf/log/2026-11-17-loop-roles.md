---
type: log-entry
date: 2026-11-17T11:00
kind: Decision
---

The subagents build; the main agent merges, gets the owner's decisions so that issues become ready, and structures the work, including tasks and issues that improve maintainability where the code still causes merge conflicts (owner, 2026-11-17). Subagents run only the cheap local checks; the full E2E suite, Stryker and the mutation gate run in the CI (see [Release loop](/ops/loop.md)).
