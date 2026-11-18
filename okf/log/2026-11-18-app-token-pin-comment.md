---
type: log-entry
date: 2026-11-18T15:50
kind: Fix
---

The four release workflows name the pinned version of `actions/create-github-app-token` exactly: the comment after the commit hash reads `v3.3.0` instead of `v3`. The pinned commit is unchanged. Upstream moved the tag `v3` to v3.4.0 on 2026-11-18, so the workflow lint (zizmor) reported that hash and comment no longer match and failed on every new run of every pull request. The update to v3.4.0 stays with Renovate.
