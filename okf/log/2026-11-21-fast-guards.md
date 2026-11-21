---
type: log-entry
date: 2026-11-21T08:00
kind: Decision
issues: [114, 94, 118, 169, 115]
---

Three unit tests timed out at the default of 5 s on a slow CI runner (run 44877875869); no assertion failed. The slow guards now do less redundant work, with the same cases and the same assertions, and no timeout, `numRuns` or sample was touched. What changed, per file (only test files):

- A scan that parses every source file runs as one test per group of folders (`src/test/catalog-keys.test.ts`, #114; `src/test/naming.test.ts`, #94); the groups are built from one listing, one test asserts that they cover every scanned file exactly once, and each allowed entry is checked in the group of its file.
- A reference test that rendered the same seeded sample (seed 118, 300 runs) in two or three tests now generates it once (a lazy module-level array), renders each state once (a `WeakMap` by state) and compares the array in slices of one array, with a test that the slices are the whole array (`catalog-list-reference`, `overview-reference`, `galaxy-reference`, #118). In `catalog-list-reference` the 150 runs of the comparison are the first 150 of the 300: one test generates both and asserts it.
- `achievements-reference`, `settle-reference` and `guild-chat` (#169) take their seeded sample once and test it in slices (and the three comparisons of `settle-reference` as three tests, #115); the `60_000` ms limit of the achievements test and of the guild chat property is no longer needed and is gone.

Time of the slowest single test of each file, on an idle machine (4 cores), before and after: `catalog-keys` 0.85 s, 0.21 s; `catalog-list-reference` 0.98 s, 0.59 s; `overview-reference` 0.80 s, 0.29 s; `galaxy-reference` 0.50 s, 0.18 s; `achievements-reference` 1.6 s, 0.47 s; `settle-reference` 2.6 s, 0.93 s; `naming` 1.1 s, 0.27 s; `guild-chat` 1.5 s, 0.75 s. Under three busy loops: 1.3 s, 0.35 s; 1.2 s, 0.84 s; 1.1 s, 0.47 s; 0.6 s, 0.3 s; 1.7 s, 0.49 s; 2.7 s, 1.06 s; 1.5 s, 0.37 s; 1.8 s, 0.87 s.

Not changed: `src/server/game/journal-cost.test.ts` measures 1000 actions and 1000 arrivals of 20 players on purpose (its rows and its time ratio are the assertions) and keeps its own limit; the tests of `admin-reference`, `research-reference`, `missions-reference`, `limits-reference` and `producer-rows` stay below 1.4 s each.
