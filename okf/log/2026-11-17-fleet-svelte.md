---
type: log-entry
date: 2026-11-17T16:57
kind: Code
issues: [118, 250, 240, 253, 53, 45, 129, 161]
---

#118, bundle 3 (the order of the bundles of „Geklärt, Nachtrag 3“, unchanged by „Nachtrag 4“): the fleet view, built on #250 so the buttons „alles“ of #240 are part of it, is the Svelte component `Fleet.svelte` from `fleetPage()` of the new pure module `src/client/logic/fleet.ts`, mounted by `mountFleet()` and mounted anew on every render as its HTML was, so the typed numbers, the chosen target, mission and speed, the focus and the countdowns behave as before [V]; the list „Auftrag“ comes from `missionOptions()`, whose filter keeps every mission for now and is where #253 plugs in; the list of fleets is the new `FleetMoves.svelte`, shared with the overview; what `main.ts` writes beside the form, the target (#53, #45) and the preview of the flight (#129), moved into `targetInfo()` and `previewCells()`, so `main.ts` shrinks from 1,888 to 1,848 lines and the limit of the ratchet with it; a property test keeps the component equal to the frozen HTML (300 states, seed 118, with the gift of #161), the E2E specs of the fleet form run unchanged; no visible change, so the label `kein-changelog` and no fragment (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
