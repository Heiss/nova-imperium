---
type: log-entry
date: 2026-11-13
kind: Update
issues: [144]
---

OKF and docs corrected to the workflows (#144): the release image is `<tag>`, and `latest` and `stable` point at the newest release tag; CodeQL also blocks every result of level „error“; a pull request runs only the checks its changes need (owner, 2026-11-12, replaces „the whole suite on every pull request“, also in `docs/development.md` and the README); `tag.yml`, `release-pr.yml` and the hotfix job of `security-hotfix.yml` keep checkout credentials because they push, and `tag.yml` checks out the head branch of its CI run; `pnpm typecheck` runs svelte-check (see [Test strategy](/ops/testing.md), [Branching and release](/ops/branching-release.md)).
