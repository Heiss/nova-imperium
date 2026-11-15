---
type: log-entry
date: 2026-11-14
kind: Code
issues: [118, 189]
---

#118, second pull request (owner, 2026-11-14, „Geklärt, Nachtrag 2“: after the lists the views the phone view #189 builds on, one view per pull request [V], none in parallel; recorded in §9 of the patterns): the Übersicht is the Svelte component `Overview.svelte`, mounted by `mountOverview()`, from `overviewPage()`, `fleetRows()` and `activityRows()` of the new pure module `src/client/logic/overview.ts`; it replaces `overview()` of `views/overview.ts`, and the fleet view builds its list of fleets from `fleetRows()`; the overview is mounted anew on every render, as its HTML view rendered anew, so the clock still counts its countdowns down, „Serverzeit“ stays the time of the render and the focus behaves as before; a property test keeps it equal to the frozen view before (300 states, seed 118) with the normalizer of the lists, now shared in `src/test/markup.ts`; no visible change, so the label `kein-changelog` and no fragment; E2E and axe tests unchanged; what is left in `main.ts` is listed in §9 (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
