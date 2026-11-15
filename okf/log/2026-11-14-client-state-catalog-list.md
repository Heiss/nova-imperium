---
type: log-entry
date: 2026-11-14
kind: Code
issues: [118, 183]
---

#118, first pull request (owner D1 of 2026-11-13: the lists first): the state module `src/client/logic/state.svelte.ts` (`client`, runes) holds the state of the server, the view state, the clock offset, the interface state and the completion notices, which `main.ts` no longer keeps; every game action goes through one `act()` (`createAct()` in `src/client/logic/act.ts`); the generic `CatalogList.svelte` renders Gebäude, Forschung, Schiffsschmiede and Verteidigung from `catalogPage()` of `src/client/logic/catalog-list.ts` and replaces `Buildings.svelte`, `views/economy.ts` (research), `views/yard.ts` and `itemHTML()`; Vitest loads the Svelte plugin for component tests rendered with `svelte/server`; a property test keeps the four lists equal to the frozen views before; the allow-list entry `yard` of #183 moved from `client/views/yard.ts` to `client/logic/catalog-list.ts`; what is left in `main.ts` is listed in §9 of the patterns; E2E and axe tests unchanged; **[E]** all four lists follow the clock (owner, 2026-11-14, #118, option C „Alle live + Changelog“): in Forschung, Schiffsschmiede and Verteidigung the costs and the lists „Benötigt“ update live as in Gebäude and a clicked button keeps its focus, with the fragment `changes/listen-live.md` (`art: geändert`) instead of the label `kein-changelog` (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
