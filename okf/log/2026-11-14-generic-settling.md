---
type: log-entry
date: 2026-11-14
kind: Code
issues: [115, 47]
---

#115 built: settling with generic events; `src/core/settle.ts` names no key: a segment ends at the end of the building, when the shipyard finishes a unit with production components, when a research finishes that a rate on the planet reads (`readsResearch()`), and where a use empties a stock (`accrue()`); the consumer of a stock and its throttled share come from the `consumes` components (`STOCK_USERS`, `throttle()`, `balancedShare()` without `pct.fusion`); the server settles the planets a finished research changes (`feelsResearch()`, `settleResearchEnd()`); the four allow-list entries of #115 in `src/test/catalog-keys.test.ts` are gone; property tests against the code before, bit for bit, plus split invariance within the tolerance of #47, stocks ≥ 0 and the storage limit; confirmed by the owner (2026-11-14): a read research is found automatically through a `Proxy` (no new field), a full storage does not split a segment, one consumer per stock until a second one comes (then decided with the owner), split invariance within the tolerance of #47 in every case while the comparison with the code before stays bit for bit; no visible change, label `kein-changelog` (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
