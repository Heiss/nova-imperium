---
type: log-entry
date: 2026-11-19T22:00
kind: Code
issues: [253, 118]
---

Regression of the fleet form found by `e2e/survey.spec.ts` (#253 with #118, bundle 3): a state refresh draws the fleet view anew with the missions of the shown target, `keepInputs` cannot restore a mission that is not among them (the select is empty), and `missionList` then took the first one that fits, so a chosen „Vermessung“ became „Landnahme“. `missionList` in `src/client/features/fleet.ts` now keeps the choice in `client.ui.fm` and continues from it when the select is empty; a mission that no longer fits still falls back to the first that fits. Unit tests in `src/client/features/fleet-lists.test.ts`; `e2e/survey.spec.ts` ran 5 of 5 after the fix, 0 of 5 before. See [Fleet cargo](/features/fleet-cargo.md).
