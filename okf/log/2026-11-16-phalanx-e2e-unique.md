---
type: log-entry
date: 2026-11-16T19:19
kind: Fix
issues: [252, 247]
---

#252, a random failure of the E2E tests of the Auspex-Phalanx (run 43926369508 on pull request #247): `setup()` in `e2e/phalanx.spec.ts` named every target colony „Spähziel“, so when two tests got the same home system the Sternenkarte showed two rows with that name and the lookup matched both; each colony now gets a unique name („Spähziel“ and 6 random characters, `uniqueName`), which `setup()` returns and the tests use for the row, the scan button and the heading of the panel, every assertion kept; the same pattern in `e2e/game.spec.ts` (the „Vorposten“ of the Verlegung test on a phone, whose row also matched the „Vorposten“ of the test before it) and `e2e/a11y.spec.ts` (the moon „Axe“, when two runs of the test share a system) gets unique names too; a temporary test that put two scanners' colonies into one system failed before the fix with the error of the CI run and passed after it.
