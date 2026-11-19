---
type: log-entry
date: 2026-11-17T08:45
kind: Feature
issues: [228, 116, 214, 53, 169]
---

#228 built: the server sends of a foreign fleet only what the observer's settled Auspex-Lehre recognizes, the total number of ships from 2, the ship types from 4, the exact number per type from 8 (classic default, owner D1); a part below its threshold is absent from the answer, never 0; the thresholds apply to every foreign fleet (D2), so the field `visible` of the missions of #116 is gone; the three thresholds are the settings `roundRecognitionTotal`, `roundRecognitionTypes` and `roundRecognitionCounts`, set in the dialog „Neue Runde“ and editable in the universe settings during the round (owner X1), in whole levels from 0 to 100 [V], checked by `recognitionErrors` as in #214; the overview shows „(Zusammensetzung unbekannt)“, „(Schiffe insgesamt: 7)“, „(Schiffe insgesamt: 7 · Abfangjäger, Frachtläufer)“ or the exact ships; own fleets, the scan of the Auspex-Phalanx (#53) and the attack event in the guild chat (#169, no ships) unchanged; no migration; the range message of the settings is shared as `rangeError`, which moved two killed mutants out of `admin.ts`, so new unit tests of the announcement keep and raise its mutation floor (see [Espionage defense](/features/espionage-defense.md), [Admin](/features/admin.md)).
