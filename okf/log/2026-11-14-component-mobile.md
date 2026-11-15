---
type: log-entry
date: 2026-11-14
kind: Code
issues: [114]
---

#114 (flight) built: the owner's decisions for the flight group; every ship that flies exports the component `mobile` (`{ cargo, speed, fuel, drive, drives? }`, the drive switch as data) with a contract test; the Sonnenreliquiar has none, its flight values are the core constant `STATIONARY`, and `canFly` is „has `mobile`“; `flight.ts` reads it through `src/core/components/mobile.ts`, which now holds `DRIVE_BONUS` and `DriveKey`; `SHIPS` deeply equal, speed, fuel and cargo bit-identical by a property test against the old `flight.ts` (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
