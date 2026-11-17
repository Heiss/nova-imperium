---
type: log-entry
date: 2026-11-16T18:48
kind: Code
issues: [118, 189, 53, 45, 95]
---

#118, bundle 2 (the order of the bundles of „Geklärt, Nachtrag 3“, unchanged by „Nachtrag 4“): the Sternenkarte, which the phone view #189 builds on too, is the Svelte component `Galaxy.svelte` (its countdowns in `Due.svelte`, now shared with the overview) from `galaxyPage()` of the new pure module `src/client/logic/galaxy.ts`, mounted by `mountGalaxy()` and mounted anew on every render as its HTML was, so the focus after Enter, the typed system, the planet textures and the countdowns of the scan behave as before [V]; the actions are data, while the symbols of the moon and the Trümmerfeld, „Bergung“ and the pictures of #53 and #45 keep their HTML, so `logic/moon.ts` and `logic/debris.ts` stay unchanged (the mission „Mondbruch“ #95 is built meanwhile); `gfleet` and `gspy` read their target with `targetOf()`, so `main.ts` shrinks from 1,875 to 1,873 lines; a property test keeps the component equal to the frozen HTML (300 states, seed 118), and the shared normalizer reads `data-nokeep=""` as `data-nokeep`; the tests of the HTML view run on the component, the new `e2e/galaxy.spec.ts` checks the view on desktop and phone; no visible change, so the label `kein-changelog` and no fragment (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
