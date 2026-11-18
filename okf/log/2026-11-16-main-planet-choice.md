---
type: log-entry
date: 2026-11-16T22:22
kind: Decision and code
issues: [221, 222, 191, 49, 224]
---

#221 built (part of #222) with the owner's answers of 2026-11-16: the main planet („Hauptplanet“) is chosen in the options among the own planets, never a moon [V]; it decides navigation and research (D1: the link „zum Heimatsystem“, the planet shown without a selection, the research view's planet), while rewards, the Endzeit gift and the fields stay with the first planet, which keeps the name „Heimatplanet“ (D2); every switch starts the lock, the first one and a switch back too (D4, D5); a main planet that is no longer the player's falls back to the oldest planet left without a lock (D6); the lock is a round value in the dialog „Neue Runde“, 7 days by default (D3), whole days from 1 to 30 [V], kept without a choice like the guild switch of #191. [V] „Research“ covers research of before #49 (refunded to and named as the main planet) and research without a selection; research still starts on the shown planet (#49). [V] A new round forgets the choice, since a planet id is its place. Migration `20261116T2211-main-planet` adds `users.main_planet` and `users.main_switched`; the chosen main planet cannot be given up (#224 D3) once #224 is built (see [Main planet](/features/main-planet.md)).
