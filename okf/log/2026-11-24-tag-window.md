---
type: log-entry
date: 2026-11-24T19:45
kind: Decision and code
issues: [395, 387]
---

A release head of `main` merged between a hotfix tag and the rebuild that the tag starts (CodeRabbit on #395): its version is taken, `release.sh` refuses the tag and the release commit stays untagged. Verified: `tag.yml` has no follow-up in that run to keep alive (its step „After a hotfix release“ runs for hotfix branches only), and a rebuild would find no open release pull request. Taken as [V] by the coordinator: nothing is built in `tag.yml`; the case is item (5) of the open point O25, and the refusal of `release.sh` names the way out, a new release pull request on the owner's word, which takes the next free version (#387: only the owner's word starts one). Test: `src/test/release-tag.test.ts`.
