---
type: log-entry
date: 2026-11-26T08:40
kind: Code
issues: [405]
---

The passes of the highscore (#405) are computed in UTC, the same whatever the time zone of the server: the first of a UTC day is at 23:05 UTC of the day before, then every 24/N hours, so the default three passes are at 00:05, 08:05 and 16:05 in German winter time and an hour later in summer time. „Stand: HH:MM“ stands next to the highscore table, above it on a phone, on the clock of the browser.
