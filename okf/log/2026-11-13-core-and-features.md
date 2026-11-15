---
type: log-entry
date: 2026-11-13
kind: Code
issues: [112]
---

#112 built: `src/shared` renamed to `src/core` (every import, config, floor and document); `src/features/` and `src/features/missions/` with the generated, not checked-in index `src/features/index.gen.ts` (`scripts/gen-features.ts`, chained in the scripts of `package.json`, the E2E start and the Docker build); the boundary rules in `.dependency-cruiser.cjs` with their tests; no entry moved, no change of behaviour (see [Design patterns](/architecture/patterns.md)).
