---
type: log-entry
date: 2026-11-16T22:45
kind: Decision
issues: [263, 264, 265]
---

The release loop merges Renovate's ordinary patch and minor pull requests of versions from 1.0 on before it makes the release pull request ready, one at a time with a green CI Gate (owner, 2026-11-16): normal updates merge themselves only for patch, so six minor ones waited without an owner; Renovate stays with single pull requests at any time; major updates and minor updates below 1.0 wait for the owner, each with an issue: TypeScript 7 (#263), pnpm 12 (#264), Starlight 0.43 (#265) (see [Release loop](/ops/loop.md), [Branching and release](/ops/branching-release.md)).
