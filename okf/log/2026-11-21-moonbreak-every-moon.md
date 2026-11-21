---
type: log-entry
date: 2026-11-21T06:46
kind: Decision and code
issues: [95, 237]
---

#95: the action „Mondbruch“ of the Sternenkarte shows at every foreign moon, with or without a Weltenbrecher on the shown planet (owner, 2026-11-21); the first build of today asked for one. `canOffer` of `src/core/mission-fit.ts` no longer asks the ships; the fleet form refuses a send without a Weltenbrecher, as before. Changed expectations: the unit tests of the link (it is offered without the ship), the list of the actions of a foreign moon in `src/client/logic/galaxy.test.ts`, and one more change on purpose in the frozen reference `src/test/galaxy-reference.test.ts`. The changelog fragment says so too.

Test fix, #237: the property „refuses exactly what is not valid for the setting“ of `src/core/round.test.ts` expected no refusal for every valid value; „Kolonieforschung aktivieren“ = 1 with the default base limit 0 is refused by the rule between settings. A random local run met it (seed -894992421); verified with that seed. It is the sibling of the fix of `src/core/universe.test.ts` of 2026-11-20: the property now expects the conflicts of the round, the case is a fixed example and one plain assertion pins it. The code is unchanged.
