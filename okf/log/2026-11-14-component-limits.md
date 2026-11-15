---
type: log-entry
date: 2026-11-14
kind: Code
issues: [114, 118]
---

#114 (limits) built: the owner's decisions for the limits group; the shield domes export the component `limit` (`{ perPlanet: 1 }`) and the Gravitonforschung and the Weltenschmiede `energyThreshold` (`{ base, f }`), each with a contract test; `unitRoom` in `yard.ts` reads `LIMIT` through `src/core/components/limit.ts`, and `energyNeed`/`energyShort` moved to `src/core/components/energy-threshold.ts`, which `research.ts` exports unchanged; `DEF` keeps `once: true` and the tables the field `energy` until #118, deeply equal; room, largest order, energy need and shortage bit-identical by a property test against the old code (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
