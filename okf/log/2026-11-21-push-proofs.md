---
type: log-entry
date: 2026-11-21T17:00
kind: Decision and code
issues: [342, 309, 147]
---

#342 (owner, 2026-11-21, [E]): a push to `main` or a hotfix branch does not repeat what already ran green on identical content ([Proofs of a push run](/ops/testing/push-proofs.md), [Branches and releases](/ops/branching-release.md)); it replaces the rule „every push to `main` runs the full suite“ of 2026-11-11. The new script `scripts/already-tested.ts` finds the pull request the pushed commit merged and proves each expensive job that succeeded in a green CI run of its head with the identical Git tree; the job „Detect changes“ passes the proofs on, each job skips with its proof, and the CI Gate requires the own success or the named proof and prints it. Every other case and every error runs everything. A push after a pull request that mutated its changed files only (#309) still runs the complete shards; whether it should is open for the owner (O23). The draft release pull request proves nothing (#147). Not visible to players: no changelog fragment.
