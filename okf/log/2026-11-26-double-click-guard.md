---
type: log-entry
date: 2026-11-26T23:40
kind: Fix
issues: [425]
---

A clicked `data-act` element stays locked while the promise of its handler runs (#425, owner, 2026-11-26, 186a): `src/client/dispatch.ts` runs each click through `runLocked` of `src/client/logic/act-lock.ts`, a second click on the same element runs nothing, and the lock ends in `finally`, also after a refusal or a rejected promise. The lock is per element and kept in a `WeakSet`, touches no attribute and blocks no other button; a handler that returns no promise locks nothing. Forms are not locked (186a, not 186c), although nothing in the submit listener stops a double submit from sending twice.
