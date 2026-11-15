---
type: log-entry
date: 2026-11-12
kind: Update
---

Releases only through the release pull request: every player-visible pull request brings a German fragment in `changes/`, the release pull request bundles them into `CHANGELOG.md` and `VERSION` and runs every check, its merge tags the release; hotfixes from `hotfix/*`; the Docker and Compose checks run on pull requests only when the image can change (see [Branching and release](/ops/branching-release.md), [Changelog in the game](/features/changelog.md)).
