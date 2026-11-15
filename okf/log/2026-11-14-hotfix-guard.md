---
type: log-entry
date: 2026-11-14
kind: Code
issues: [147]
---

#147 hotfix guard (owner, 2026-11-14): `scripts/release-pr.sh` writes the marker `<!-- release-pr: unmerged-hotfix -->` while a released hotfix is not merged back, and `release-ready.yml` then refuses „Ready for review“: back to draft, one comment, no label; `pull_request_target` of „Release ready“ confirmed [E]; tests with a stub `gh` for the workflow step and for `release-pr.sh` in a throwaway repository (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
