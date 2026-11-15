---
type: log-entry
date: 2026-11-13
kind: Code
issues: [117]
---

#117 built: `Store` split into one repository per aggregate in `src/server/db/repos/` (players and accounts, planets, fleets, reports, guilds, invitations, admin data) with a test file each against SQLite in memory; `Ctx` carries them as flat fields with `tx` and `db`; `Store` is a thin facade with every former method name; guild, round, audit and moderation SQL moved verbatim; no change of behaviour, schema or migrations; the owner's further decisions of #117 recorded (see [Design patterns](/architecture/patterns.md)).
