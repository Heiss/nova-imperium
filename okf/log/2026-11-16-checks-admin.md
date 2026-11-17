---
type: log-entry
date: 2026-11-16T19:32
kind: Code
issues: [214]
---

#214, the admin pull request: the checks of `settings`, `reset` and `endzeit` are pure functions of `src/core` that return codes, worded by the server from a table, so the three follow section 7 of [Design patterns](/architecture/patterns.md): `universeErrors` and `universeOf` (`core/universe.ts`, codes `range` and `used`, every refused setting at once; the messages unchanged), `roundError` and `roundChoice` (the new `core/round.ts`, codes `rewards` then `guilds`; the messages unchanged) and `endzeitError` (`core/endzeit.ts`, codes `done` then `minutes`); F15 unified as the owner settled O18 (c): the „Endzeit“ dialog asks `endzeitError` too and sends nothing with a wrong time, showing the server's text, and a second trigger is refused with the text of the box, „In dieser Runde wurde die Endzeit schon eingeläutet.“, instead of „Die Endzeit wurde in dieser Runde schon eingeläutet.“ [V]; the Endzeit is not released yet, so no player sees a changed text and the label is `kein-changelog`; unit and property tests per check, the old messages checked on the server, a test keeps the texts of browser and server equal, the E2E test of the Endzeit refuses a time of 0 without a request (see [Checks of the server actions](/architecture/action-checks.md), [Endzeit](/features/endzeit.md)).
