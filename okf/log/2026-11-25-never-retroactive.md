---
type: log-entry
date: 2026-11-25T16:00
kind: Decision and code
issues: [395]
---

Never a release after a newer one (owner, 2026-11-25, question 108 on pull request #395): gaps in the version numbers stay allowed, but a version at or below the newest CalVer tag is never released, a hotfix release included. The occasion: 26.11.26 was kept by an old release pull request when the security hotfix took 26.11.27, so the next release is 26.11.28. The CI of a release head (`release-pr.sh check`) refuses such a version and names the newest tag and the way out; `release.sh` tags none, so nothing is published and no alias moves. The parts of YY.M.MICRO are compared as numbers. The guard closes the window of item (5) of O25. Tests: `src/test/release-guards.test.ts` and `src/test/release-tag.test.ts` (below and equal to the newest tag, 26.11.9 against 26.11.10, a month and a year over, the next version and a gap pass); they fail on the scripts before.

The allocation too (owner, 2026-11-25, 108a): a hotfix takes the next version after the tags and ignores the version held by the open release pull request of `main`, which moves one up on its rebuild after the hotfix release. `heldBy` of `scripts/changelog.ts` (`next-version`) and `taken_by` of `scripts/release-pr.sh` leave out `release/main` for a hotfix and still count every hotfix for `main`, so in a collision `main` yields, never the hotfix. Tests: the scenario of 26.11.26 in `src/test/release-guards.test.ts` (the hotfix takes the version main held, main's head is refused, rebuilt it takes the next one; it fails on the scripts before), two hotfixes still keep apart, and `heldBy` in `src/test/changelog.test.ts`.
