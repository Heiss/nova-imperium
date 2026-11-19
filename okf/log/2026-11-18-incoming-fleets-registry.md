---
type: log-entry
date: 2026-11-18T10:00
kind: Code
issues: [228, 283, 229, 55, 214]
---

#228 on the registry of #283: the three thresholds of the recognition of foreign fleets are now the entries `RECOGNITION_TOTAL_SETTING`, `RECOGNITION_TYPES_SETTING` and `RECOGNITION_COUNTS_SETTING` in `src/core/fleet-recognition.ts`, with the orders 120, 130 and 140 (60 to 90 are left to #229, 100 and 110 to #55), the labels, the range 0 to 100 and the defaults 2 / 4 / 8 as before, each `live` (owner X1): a field of the dialog „Neue Runde“ and a row of the universe settings. They are one group `recognition` without a legend, so the dialog shows three single number fields and the server refuses every wrong threshold at once with the range wording, as the group rule of #214 says; an object that leaves a threshold out is now refused. The hand-wired check, universe specs and client request of the first build are gone, and `roundRules()` names the values `recognitionTotal`, `recognitionTypes` and `recognitionCounts` (see [Espionage defense](/features/espionage-defense.md), [Admin](/features/admin.md)).
