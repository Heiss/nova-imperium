---
type: log-entry
date: 2026-11-16T23:30
kind: Fix
issues: [267]
---

#267, two E2E tests that failed on a repeat run against the shared database: „creates a guild and restores its profile after reload“ in `e2e/game.spec.ts` founded a guild with the fixed tag „NOVA“ and the fixed name „Nova Allianz“, and the server refuses a second guild with the same tag or name; the tag is now „N“ and 6 random characters in capitals (`uniqueName`, within the rule of 2 to 8 letters or digits) and the name „Nova Allianz“ with that tag, and the heading after the reload is checked with both; the test of the tab „Fehler“ and the dialog „Problem melden“ in `e2e/a11y.spec.ts` (#126) seeded the fixed server error „Axe-Testfehler“, so a second run showed two matching rows; the error text is now unique per run („Axe-Testfehler“ and 6 random characters) and the row is found by it; no product change, every assertion kept; both specs pass with `--repeat-each 3`.
