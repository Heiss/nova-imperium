---
type: log-entry
date: 2026-11-14
kind: Code
issues: [114, 115, 183, 116]
---

#114 (ProducerTable) built: the owner's decisions for the last pull request; the resources page is `ProducerTable.svelte`, mounted like the buildings, with its rows from the new core function `producerRows()` (same list, factor `f` and throttled share as `production()`), checked against `prod()` by a property test; the shipyard energy line and the buildings' use at the next level come from `pieceEnergy()` and `useAt()`, the plural „Sonnenreliquiare“ and „je Reliquiar“ are text fields of the entry; a scan test of `src` fails on comparisons with a catalog key, with a named allow-list counted per file and key whose counts may only fall, a higher and a lower count both fail (#115, #183 for the lab and shipyard locks; after the merge of #116 its entries are gone, and the report type `spy`, a word equal to a key, is allowed for good as `permanent`, owner 2026-11-14); the state „not enough energy“ of buildings and research renamed from `energy` to `noEnergy`, so the scan no longer hits it; owner answers of 2026-11-14 recorded; the open [V] of §1 confirmed; no visible change, label `kein-changelog` (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
