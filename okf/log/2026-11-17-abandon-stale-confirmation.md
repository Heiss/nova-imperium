---
type: log-entry
date: 2026-11-17T16:30
kind: Decision and code
issues: [224, 282, 214]
---

#224, on a CodeRabbit finding in pull request #282 and the owner's answer of 2026-11-17: a confirmation of „Kolonie aufgeben“ that stays open longer than the lock no longer deletes a colony founded again at the same position. The dialog sends the colony's founding time with its id, and the server refuses before deleting anything when the planet's founding time differs, with „Diese Kolonie gibt es so nicht mehr.“ The check is the code `stale` of `abandonError` in `src/core/abandon.ts` (#214), asked after the target itself and before the references (see [Abandon a colony](/features/abandon-colony.md)).
