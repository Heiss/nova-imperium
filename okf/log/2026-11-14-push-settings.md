---
type: log-entry
date: 2026-11-14
kind: Code
issues: [192, 45, 169]
---

#192 built, with the owner's decisions of 2026-11-14: every kind of Web Push can be switched on and off in „Hilfe & Optionen“ under „Benachrichtigungen“, per account for all devices, every kind on by default, the box only on a server with Web Push; eleven kinds: nine from every place that sends a push (the report kind „messages“ split into own fleets (the Bergung of #45 included), attack, espionage and delivery on the player's planets, server announcement and new version) plus guild events and guild chat messages for #169, which nothing sends yet; migration 17 adds `push_off` and `push_jobs.topic`; delivery drops a due push of a kind that is off (see [Push settings per kind](/features/push-settings.md), [SQLite storage](/data/sqlite.md)).
