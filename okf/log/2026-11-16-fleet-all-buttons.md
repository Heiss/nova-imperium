---
type: log-entry
date: 2026-11-16T18:00
kind: Feature
issues: [240]
---

#240, the cargo buttons of the fleet form, built with the owner's decisions of 2026-11-16: „alles“ fills the holds evenly (`cargoMax` in `src/client/logic/game.ts`, equal shares of the capacity, a scarce resource gives the rest to the others, Promethium after the fuel) and now reads „alles (gleichmäßig)“; a small „alles“ under each cargo field (`cargoOne`) loads only its resource up to the capacity the other two fields leave; D1, D2, D3, the rounding and the texts taken as recommended [V]; no change on the server; unit, E2E (desktop and phone) and axe tests (see [Cargo buttons of the fleet form](/features/fleet-cargo.md), [Test strategy](/ops/testing.md)).
