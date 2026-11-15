---
type: log-entry
date: 2026-11-13
kind: Code
issues: [114]
---

#114 (production) built: all 49 catalog entries in `src/features/<key>/entry.ts` with `kind`, `order`, the components `leveled`, `produces`, `consumes`, `storage` and their other fields unchanged; `catalog.ts` builds the tables from the generated index in today's order; one rule module and contract test per component in `src/core/components/`; `prod()` and `caps()` from the components, bit-identical by a property test against the old `prod()`; `PRODUCERS` derived; no change of behaviour (see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md)).
