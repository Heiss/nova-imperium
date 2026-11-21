---
type: log-entry
date: 2026-11-21T17:45
kind: Code
issues: [335, 226, 223, 342, 167]
---

Answers of the coordinator to the review of the collecting branch (2026-11-21, [V]). #335: the admin's hint of the table „Spielaktivität“ reads „<n> Aktionen in 1 Min.“ instead of „<n> Spielaktionen in 1 Min.“, so the raw count of the audit log and the „Spielaktionen“ of the player's own box no longer share a word ([Own activity](/features/own-activity.md); the frozen reference copy of the admin panels changes with it). #226 and #223: that private messages sent in vacation mode count as „Spielaktionen“ on a day without play time is noted as a known consequence, not changed. #342: a pull request whose „Detect changes“ found nothing to mutate proves the mutation jobs of the push (its note „Mutation jobs“ says false); one that took over the result of its head before (#167) does not ([Proofs of a push run](/ops/testing/push-proofs.md)).
