---
type: log-entry
date: 2026-11-22T21:10
kind: Decision
issues: [351]
---

The lessons of the release 26.11.25 as rules, by the owner's decision of 2026-11-22 on #351 (every lesson gets one consequence). [Release loop](/ops/loop.md) and its mirror `.claude/loop.md`: before every push to a pull request the complete unit suite and Stryker on every changed mutated file (it replaces the local Stryker run only for files close to their floor); the export of the error log of the live server before every release; a retrospective after every release. [Branching and release](/ops/branching-release.md), a new section „Collecting pull request“: CodeRabbit asked at the first push, the scope of a release closes (the moment is a proposal), and the release of 26.11.25 from its collecting pull request. A new concept [v3](/ops/v3.md) with the decisions on #351. The first retrospective is [the one of 26.11.25](/log/2026-11-22-retro-25.md).
