---
type: log-entry
date: 2026-11-18T04:20
kind: Code
issues: [229, 283, 224, 118, 278, 214]
---

#229 brought up to main: the four thresholds of the activity markers are entries of the registry of the round settings (#283) in `src/core/activity.ts`, with the orders 60 to 90 after the lock of a given-up position (#224), all `live` (X1), with the labels, ranges and defaults as built; the hand wiring in `RoundRules`, `roundRules()`, `startRoundRules()`, `UNIVERSE_SPECS`, the dialog „Neue Runde“ and the client's request is gone. [V] They are one group `activity` without a legend, so every wrong threshold is still refused at once with the range wording; `RoundRules` holds them as `activityRecent`, `activityMinutes`, `inactiveDays` and `longInactiveDays`. The markers moved into the Svelte Sternenkarte (#118, #278): `galaxyPage()` gives each place the words, `Galaxy.svelte` shows them. The refusals stay pure checks of the core (#214) (see [Activity indicators](/features/activity-indicators.md), [Admin](/features/admin.md)).
