---
type: log-entry
date: 2026-11-24T19:30
kind: Fix
issues: [395, 373, 379, 374, 378]
---

CodeQL found a dynamic method call on a name from the address (pull request #395, `js/unvalidated-dynamic-method-call`): the rule of whether a view is offered (#373) was looked up in a plain object, so `?view=hasOwnProperty` called a function of the object's prototype and threw, and `?view=constructor` answered an object. The rules are a `Map` now. The same sweep over the new code: the address parameters of a view (#379) are read through `namesOf` (own entries only), the switches of the server features (#374) are a `Map` keyed by the name of an action from the browser, and the option boxes (#378) are looked up by no outside name. Tests: names of the prototype (`constructor`, `hasOwnProperty`, `__proto__`, `toString`, `valueOf`) are an unknown view, read no address parameter and are refused as an unknown action (`src/client/views/registry.test.ts`, `src/server/game/registry.test.ts`).
