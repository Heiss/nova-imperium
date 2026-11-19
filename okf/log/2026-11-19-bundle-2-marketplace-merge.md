---
type: log-entry
date: 2026-11-19T14:00
kind: Decision and code
issues: [316, 171, 54, 190, 223, 78, 118]
---

The second Classic bundle (#316) merged main again, which had gained the marketplace (#171: the Handelsposten, `src/core/market.ts` with its twelve round settings, the action `trade`, the view „Marktplatz“, `featureActs`). Twelve files conflicted; both sides stay in each. The Raketenkrypta of the missiles (#54) and the Handelsposten both had the building order 170 and the catalog test wants every order once per kind, so **[V]** main's value stays (it is released) and the Raketenkrypta takes the next free number, 180 (the research orders end at 160 with the Auspex-Kartographie of #190, the mission orders 10 to 90 are unique). The catalog has 58 entries. `src/test/naming.ts` skips a classic name that is missing, null (#190) or equal to the new name (#54) by one function. The option handlers of the vacation mode (#223) join `featureActs`, so `src/client/main.ts` has 1788 lines (main's limit: 1808).

The interactions are pinned by tests: `trade` is no part of the allow list of the vacation mode, so it is refused and changes no stock, price or amount of the day, the locked state carries no `market` and the lock screen shows nothing of the market; the Handelsposten and the Raketenkrypta count in the buildings category and in the total like every building (#78); the building list shows both, the Raketenkrypta with the places of its missiles only.

The first CI run of the merge failed in two tests that need the seeded sample (seed 118) to reach every branch: `catalog-list-reference` (no running upgrade of the Scholarium in 300 runs) and `overview-reference` („Nichts in Arbeit“ in none). Both sides had raised the number of runs before, and every new catalog entry (#171, #190) moves the sample again. The numbers of runs stay at 300; both tests now also render hand-built states for the rare branches, compare them with the frozen views and check that the hand-built states alone reach every rare branch, so a new catalog entry cannot lose one (#118).
