---
type: log-entry
date: 2026-11-21T08:00
kind: Code
issues: [54, 202]
---

#54 and #202, the two parts that were open (owner, 2026-11-21, [E]). Tearing missiles down: the action `tearDownMissiles` removes the chosen amount of stored Abfangraketen or Orbitalraketen of the selected planet at once, so their places in the Raketenkrypta are free; it costs nothing and gives nothing back. Its check is the pure `tearDownError` of `src/core/missiles.ts` (not a missile, not a whole number from 1 on, more than the stock; the shipyard queue is no stock); the vacation lock holds as for every action, the audit entry and the journal input are declared. The list „Verteidigung“ shows at a row with missiles in store a number field and the button „Verschrotten“ with a confirmation; the points drop with the units. The demolition of the Raketenkrypta: `demolitionErrors` has the code `siloBusy`; a level is refused while the places left after it would be fewer than the missiles there, the shipyard queue counted as for the order of a missile (`siloUse`); exactly as many places as missiles is allowed. [V] The words: „Verschrotten“ (the guard rejects „Abbauen“, the classic word of the harvest), „Menge verschrotten: <Name>“ (no „Anzahl“, which the E2E specs find the order field by), the confirmation, „Nicht so viele Raketen vorhanden.“ and „Die Raketenkrypta lagert zu viele Raketen.“. The frozen reference of the lists got one more marked change (the control of a missile row). The Lexicanum rule pages „Raketen“ and the demolition name both rules.
