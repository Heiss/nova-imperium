---
type: log-entry
date: 2026-11-20T09:00
kind: Feature
issues: [189]
---

#189, D5 finished with the owner's choice (a) of 2026-11-20: the card „Bereit“ of the phone overview names the other own places with an empty build queue, „Bauschleife leer: <Name> [g:s:p]“ with the button „Wechseln“, at most three, then „und N weitere“ [V, wording and limit]. The server sends the ids of those places in a new state part `idle` (order 220, `src/server/game/idle-queues.ts`): the own planets and moons but the shown one whose building queue is empty or ended, ids only; the browser words them from the galaxy. See [Interface v2](/features/interface.md).
