---
type: log-entry
date: 2026-11-21T09:20
kind: Code
issues: [95, 334]
---

#95, mutation floor. The complete run on #334 (44877875869, e57d5a0, total 96.69 %) left one file below its floor: `src/client/logic/galaxy.ts` 99.59 % under 100 %. The survivor was the fleet argument of the Mondbruch link (`{ owner, from }` to `{}`): for a foreign moon the result is the same without it, so no test could tell. The link now asks the list of the fleet form itself (`offeredMissions` of `src/client/logic/fleet-target.ts`), so the Sternenkarte offers the Mondbruch exactly where the form lists it, and the helper `canOffer` of `src/core/mission-fit.ts`, added this morning, is gone again (the file and its test are as on main). Behaviour unchanged. The coordinator had not run Stryker locally on this change before the push; it is run now.

The faster guard tests (`okf/log/2026-11-21-fast-guards.md`) come into this pull request with the same push: a new complete run is needed anyway, and they take the three tests that timed out on a slow runner far below the limit.
