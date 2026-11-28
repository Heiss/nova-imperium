---
type: log-entry
date: 2026-11-27T19:57
kind: Feature
issues: [450, 408, 425, 428]
---

The server runs a repeated action once (#450, owner, 2026-11-27, 292a): the browser sends every action and admin write with a key of its own in the header `Idempotency-Key`, and the server keeps the outcome of each key per player for 60 s. A repeat gets the first answer, with the state of now, and runs nothing. A request without a key runs as before until #408 makes the key required. The locks in the browser of #425 and #428 stay (see [Server actions](/architecture/patterns/07-server-actions.md)).
