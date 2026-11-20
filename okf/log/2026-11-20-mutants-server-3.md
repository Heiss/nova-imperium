---
type: log-entry
date: 2026-11-20T14:00
kind: Code
issues: [235, 54]
---

Mutation tests of the journal of the round (#235) and the highscore categories (#54), on the collecting branch (CI run 44707627812). `src/server/game/journal-input.test.ts` pins the allow-list of the journal input by hand, action by action: which fields are kept, which are reduced to their length, which become a seat, that every other field (a password, a code, a token, an e-mail address, a name of the object prototype) is dropped, and how a kept value is bounded (64 characters, three levels, 400 characters of JSON). `src/server/game/journal-causes.test.ts` drives the journal directly: the cause that collects, the production of a saved place per resource, a finished building and finished units, the reports and the battle, the scrubbed refusal, the fate of a fleet and a failing write. Three equivalent conditions were simplified without a change of behaviour (`finishedBuilding` in `journal.ts`, `hiddenTexts` in `journal-input.ts`, the list of units that fight in `highscore.ts`, whose filter for defense was redundant because a place holds no ship in its defense). The state test now pins the logical time and the reports of the player, the highscore test that a missile is no defense. No game rule, text or floor changed.
