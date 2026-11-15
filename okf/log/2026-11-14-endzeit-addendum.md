---
type: log-entry
date: 2026-11-14
kind: Decision and code
issues: [161]
---

#161, „Geklärt, Nachtrag“ (owner, 2026-11-14): the default flight time of the gift is its own field of the universe settings (`endzeitMinutes`, „Flugzeit der Endzeit-Gabe (Minuten)“, 1 to 4,320, default 240); the dialog is prefilled from it and changes it for one trigger only, the last used value is no longer saved; the arrival message (sentence as title and text), the start title „Endzeit“ and the research refund are decided [E] (a cancelled research is refunded on the planet where it started, and on the home planet only when that planet no longer exists or belongs to someone else); `e2e/seed.ts` takes `gift` and a @phone test checks the fleet list (see [Endzeit](/features/endzeit.md)).
