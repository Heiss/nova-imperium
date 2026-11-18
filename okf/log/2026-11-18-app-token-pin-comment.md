---
type: log-entry
date: 2026-11-18T15:40
kind: Fix
---

The job „Workflow lint“ failed for every pull request from about 15:27 UTC: upstream moved the tag `v3` of `actions/create-github-app-token` from v3.3.0 to v3.4.0, and zizmor found that the pinned commit no longer matches its comment `# v3`; the comment now names the exact version of the pinned commit (`# v3.3.0`) in the four workflows, the code stays the same, and Renovate brings v3.4.0 after its three days (see [Test strategy](/ops/testing.md)).
