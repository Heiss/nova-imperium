---
type: log-entry
date: 2026-11-19T23:00
kind: Code
issues: [253, 118, 53]
---

Second part of the fleet form regression (#253 with #118, bundle 3, moons #53): a state refresh drew the fleet view anew with „Mond“ disabled in „Zielart“ (the form is built for the start planet), `keepInputs` does not restore onto a disabled option, and a fleet aimed at a moon went to the planet. The chosen kind is now kept in `client.ui.fk` and set again by `moonOption` in `src/client/features/fleet.ts`, written by the select, the Schnellwahl, the union (`features/union.ts`) and the shortcut of the Sternenkarte (`features/galaxy.ts`) and cleared on sending. Unit tests in `src/client/features/fleet-lists.test.ts`. See [Fleet cargo](/features/fleet-cargo.md).
