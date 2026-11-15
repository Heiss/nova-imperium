---
type: log-entry
date: 2026-11-12
kind: Feature
---

Security hotfix: Trivy scans `stable` every hour; a High or Critical hole with a fix becomes `hotfix/sec-<id>` from the release tag and releases itself when the CI Gate is green; the base image is pinned to its digest (see [Branching and release](/ops/branching-release.md)).
