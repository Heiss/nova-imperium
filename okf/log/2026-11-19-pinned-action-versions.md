---
type: log-entry
date: 2026-11-19T19:00
kind: Code
issues: [303, 299]
---

#303 [V]: the owner has not chosen among its four options; option 1 is built because it follows #299, where the owner set `actions/create-github-app-token` to `# v3.3.0`. The version comment of every pinned action in `.github/workflows` now names the exact release that the commit hash carries (for example `actions/checkout@3d3c42e… # v7.0.1`), read for each hash from the tags of its repository; no moving major tag is left. Checked with actionlint 1.7.12 and zizmor 1.32.0 in offline mode; the online audit of the CI could not run in the session (no token for api.github.com). Whether Renovate keeps the exact comment on its own updates is not verified [U]. See [Testing](/ops/testing.md).
