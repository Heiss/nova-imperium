---
type: log-entry
date: 2026-11-16T23:20
kind: Decision
---

Small patches are slotted in between features instead of waiting for the release (owner, 2026-11-16): the main agent merges Renovate's green patch and minor pull requests (one at a time, CI Gate green on a head up to date with `main`; a major update and a minor one below 1.0 wait for the owner) while it waits and follows up Dependabot alerts without a Renovate security pull request; a small bug or cleanup issue may be the next issue of a free subagent (see [Release loop](/ops/loop.md)).
