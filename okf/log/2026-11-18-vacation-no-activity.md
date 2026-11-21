---
type: log-entry
date: 2026-11-18T23:00
kind: Decision and code
issues: [223, 229]
---

#223, the owner's „Geklärt“ comment of 2026-11-18: an account in vacation mode records no activity. `recordActivity` (#229) returns at once while `vacation !== null`, so the login onto the lock screen, the state request, a refused action, `pushOptions` and `POST /api/activity` leave the times of the account and its planets as they were; `endVacation` counts as activity again from that action on (`actionReply`). Tests in the routes and activity tests (see [Vacation mode](/features/vacation-mode.md), [Activity indicators](/features/activity-indicators.md)).
