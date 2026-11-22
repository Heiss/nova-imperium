---
type: log-entry
date: 2026-11-22T16:00
kind: Decision
issues: [363]
---

26.11.25 is released from the collecting pull request, without a release pull request and without a candidate image, by the owner's exception for this release (2026-11-22): the collecting branch carries the bookkeeping of the release App (`node scripts/changelog.ts release 26.11.25`: the section in `CHANGELOG.md`, `VERSION`, the fragments removed), and `tag.yml` tags its merge into main after the green push run. The version was given by hand: `next-version main` names 26.11.26, because the open branch `release/main` holds 26.11.25 (the App asks with `next-version release/main`). The check „Changelog fragments“ finds no fragment once they are bundled and needs the label `kein-changelog` on the pull request. #363 is the planned rule for such a release.
