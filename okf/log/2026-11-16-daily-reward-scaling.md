---
type: log-entry
date: 2026-11-16T21:48
kind: Feature
issues: [220, 238]
---

The daily reward scales with the day of the round (#220): the median hourly production of all players times 30 minutes on day 1, rising along round(30 + 60 · ln(d) / ln(30)) to 90 minutes from day 30 on; a missed day resets only the shown streak, achievements stay fixed, no cap. The start of the round is stored with a migration in the layout of #238 (a running round starts at its first planet) ([Admin](/features/admin.md)).
