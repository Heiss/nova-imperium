---
type: log-entry
date: 2026-11-24T18:45
kind: Code
issues: [395, 147]
---

The CI of a release head refuses what the release pull request only keeps a draft for (CodeRabbit on #395, taken as [V] by the coordinator): „Detect changes“ runs `sh scripts/release-pr.sh check` on every push to a `release/*` head and fails while a released hotfix is not merged back into `main`, while another release branch holds its version, or while its version is a tag already (the protections of #147, plus the tag). The checks are functions of `scripts/release-pr.sh` itself, shared by the build of the release pull request and by the check. Tests: `src/test/release-guards.test.ts` (a clean head passes; each refusal; a head rebuilt after the hotfix is merged back passes again; the step in „Detect changes“ for every push); `src/test/release-pr.test.ts` unchanged and green.
