---
type: log-entry
date: 2026-11-18T14:20
kind: Code
issues: [283, 290]
---

A test for the registry of #283: only a number is a row of the universe settings, never a switch that carries `live` by mistake. Since #290 a mutant of this condition in `src/core/universe.ts` survived, so the mutation gate of every later pull request failed at the floor of 100 %. No visible change.
