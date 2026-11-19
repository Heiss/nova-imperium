---
type: log-entry
date: 2026-11-18T16:30
kind: Decision and code
issues: [228, 300, 229, 214, 283]
---

#228 decided on PR #300 (owner, 2026-11-18): the three thresholds of the recognition of foreign fleets stand in the dialog „Neue Runde“ in one framed group (a fieldset) with the legend „Fremde Flotten erkennen“, like „Aktivität“ of #229, and the field labels stay as they are [E]; each threshold is a whole number from 0 to 100 [E], no longer a proposal. Built: the group `recognition` of `src/core/fleet-recognition.ts` carries the `legend` as the reward group of #214 does, so the dialog of the registry (#283) draws the fieldset; the dialog tests check the fieldset and its legend, the E2E spec the group with its three fields (see [Espionage defense](/features/espionage-defense.md), [Admin](/features/admin.md)).
