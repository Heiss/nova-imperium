---
type: log-entry
date: 2026-11-14
kind: Code
issues: [147]
---

#147 built: the release pull request of `main` stays a draft after every rebuild (`scripts/release-pr.sh` no longer marks it ready; hotfix release pull requests keep it and their auto-merge); its draft runs the cheap checks only (secrets and dependencies, migrations, workflow lint, CodeQL, changelog fragments) and its CI Gate fails on purpose, so no merge and no candidate image follow it; „Ready for review“ starts the full run through the new workflow `release-ready.yml` (`pull_request_target`, only head `release/main`), which adds and removes the label `voller-lauf` with the release App's token, because `ci.yml` keeps its event types (a skipped CI Gate counts as success); the CI Gate requires every check in every other release pull request; the loop marks the release ready, waits for the full run and the candidate image; `src/test/ci-release.test.ts` runs the shell of both jobs; first-release checks marked [U] (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md), [Test strategy](/ops/testing.md)).
