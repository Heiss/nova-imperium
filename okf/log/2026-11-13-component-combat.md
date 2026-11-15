---
type: log-entry
date: 2026-11-13
kind: Code
issues: [114]
---

#114 (combat) built: the owner's decisions for the combat group; ships and defense export the components `unit` (`{ cost }`) and `combat` (`{ atk, sh, rf? }`, `easy` on the Spähschädel and the Sonnenreliquiar) with a contract test each; `battle.ts` reads them through `src/core/components/combat.ts` (hull from the cost, rapid fire 5 against easy targets as a core constant) instead of the key list; `SHIPS`, `DEF` and `UNIT` deeply equal, battles bit-identical by a property test against the old `battle()` (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
