---
type: log-entry
date: 2026-11-17T06:00
kind: Decision and code
issues: [224, 222, 221, 49, 214]
---

#224 built (part of #222) with the owner's answers of 2026-11-16: giving up is refused while flights, research or orders refer to the planet or its moon (D1), the position stays locked for colonization for the hours the admin sets per round, 24 by default (D2), the main planet cannot be given up (D3), and everything is lost with the moon (Q1). [V] The confirmation reuses the password check of „Account löschen“ („Passwort zur Bestätigung“, „Das bisherige Passwort ist falsch.“, the address limit); the main planet is the one of #221 as the game uses it, so the last planet is never given up; D1 counts every flight of any player from or to the planet or its moon, research on either (#49) and building or shipyard orders; the lock is `roundAbandonLock` in the dialog „Neue Runde“, whole hours from 1 to 720, and by the owner's X1 (2026-11-17) also a live row of the universe settings, and it also keeps new home planets away; a Landnahme is refused with the end of the lock and turns back if it arrives during it. The checks are pure functions in `src/core/abandon.ts` that return codes, worded by the server (#214). Migration `20261117T0540-position-locks` adds the table `position_locks` (see [Abandon a colony](/features/abandon-colony.md)).
