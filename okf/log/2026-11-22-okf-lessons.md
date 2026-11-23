---
type: log-entry
date: 2026-11-22T21:10
kind: Decision
issues: [351, 380]
---

The lessons of the release 26.11.25 as rules, by the owner's decision of 2026-11-22 on #351 (every lesson gets one consequence). [Release loop](/ops/loop.md) and its mirror `.claude/loop.md`: before every push to a pull request the complete unit suite and Stryker on every changed mutated file (it replaces the local Stryker run only for files close to their floor); the export of the error log of the live server before every release; a retrospective after every release. [Branching and release](/ops/branching-release.md), a new section „Collecting pull request“: CodeRabbit asked at the first push, the scope of a release closes (the moment is a proposal), and the release of 26.11.25 from its collecting pull request. A new concept [v3](/ops/v3.md) with the decisions on #351. The first retrospective is [the one of 26.11.25](/log/2026-11-22-retro-26-11-25.md). After the review of #380 the owner decided on 2026-11-23: the loop finds a missing retrospective by state, at the start of every iteration, for the newest release tag; the limit of five consequences holds from the next retrospective on; how the loop knows the scope of a release is open (O24 in [Open points](/open-points.md)). Refined as proposals after the second review of #380: every release tag from 26.11.25 on needs its retrospective, the loop waits for the tag of a merged release, finishes the retrospective's pull request and stops only once it is merged.
