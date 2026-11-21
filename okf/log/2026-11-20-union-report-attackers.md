---
type: log-entry
date: 2026-11-20T00:20
kind: Code
issues: [225]
---

The new E2E spec `e2e/union.spec.ts` (attack union, #225) found that the battle report of a union showed the leader alone: the server writes `attackers` and `attLoot` into the report, `src/client/logic/report-body.ts` never drew them. `attackerSides` now draws a block „Angreifer <Name>“ per attacker, in the order they joined, with the loot share under it. Unit test `src/client/logic/report-body-union.test.ts`; the changelog fragment of the union says the report shows every attacker. See [Holding, alliance depot and attack unions](/features/holding-acs.md).
