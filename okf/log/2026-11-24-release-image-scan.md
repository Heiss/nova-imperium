---
type: log-entry
date: 2026-11-24T16:00
kind: Decision and code
issues: [387]
---

A release image is scanned before the aliases move (owner, 2026-11-24, decision 79a; it replaces the open point left by #387, where no job scanned a release of `main` any more). `release.yml` has the job „Trivy of the release image“: it pulls the freshly pushed `<version>` image and blocks on every High and Critical hole that has a fix (`scripts/trivy-gate.ts`), and the job „latest and stable“ needs it. A finding fails the run and leaves `latest` and `stable` on the previous release; the tag and the `<version>` image stay. The job „latest and stable“ moves the aliases only in the run of the newest release tag [V]: before, any release run pointed them at the newest tag, so the run of an older release (a hotfix of the previous line) would have moved them onto a newer image whose scan failed. Test: `src/test/ci-release.test.ts` (the scan, its severity and gate, that the aliases need it, and that they move only to the run's own tag).
