---
type: log-entry
date: 2026-11-17T05:39
kind: Decision and code
issues: [242, 118]
---

#242, owner, 2026-11-16: a CI ratchet keeps `src/client/main.ts` from growing while #118 takes it apart. The allowed line count is stored in `size-ratchet.json` (starting value 1880, the count on `main`); `scripts/size-ratchet.ts` (`pnpm lint:size`, in `pnpm check` and in the CI job „Lint, types, unit tests with coverage, build“, so in the CI Gate) fails above the limit („move the code into a module or component“) and below it when the limit was not lowered to the new count, so every pull request that shrinks `main.ts` lowers the limit in the same change. Only `main.ts` has a limit; lines are counted as `wc -l` counts them [V] (see [Test strategy](/ops/testing.md)).
