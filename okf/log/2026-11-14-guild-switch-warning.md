---
type: log-entry
date: 2026-11-14
kind: Decision and code
issues: [191, 169]
---

#191, O14 (owner, 2026-11-14): the dialog „Neue Runde“ shows a fixed warning below the box „Gilden (mit Chat)“, always, „Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen und Rängen gelöscht.“ [V], named by the box with `aria-describedby`; „Account löschen“ (box and dialog) hides the sentence about a led guild while guilds are off (`deleteAccountBox`, `deleteAccountDialog`); the push kinds of the guild chat are decided with #169; the place of the box stays as built [V]; unit, E2E and axe tests (see [Guilds on or off per round](/features/guild-switch.md), [Open points](/open-points.md)).
