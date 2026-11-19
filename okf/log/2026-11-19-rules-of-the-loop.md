---
type: log-entry
date: 2026-11-19T16:00
kind: Decision
issues: [309, 310, 317]
---

The rules the owner set for the loop on 2026-11-18 and 2026-11-19 are written down in [Briefs for subagents](/ops/subagent-briefs.md): at most two subagents, only the cheap checks locally while the CI runs the long ones, no mutation floor from a local run and never one below main, finished features bundled into one pull request, the mutation tests of the changed files only in a pull request (#309), a design pattern when failures of one kind repeat (#310, #317); with them the experience of these two days (order of merges, shared data of the E2E specs, tests that depend on chance).
