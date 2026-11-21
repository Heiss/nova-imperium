---
type: log-entry
date: 2026-11-20T17:27
kind: Code
issues: [189]
---

#189, test fix. `e2e/touch-targets.spec.ts` failed once in the CI (run 44778851744, „tab bar is on the page“: 0 boxes) while the page snapshot of the failure shows the tab bar with its five entries. Cause: the test measured with `locator.evaluateAll`, which finds the elements in one step and measures them in a second one (playwright-core 1.65.1, `_evalOnSelectorAll`). Every render mounts the frame anew (`views/frame.ts`), so a redraw between the two steps leaves elements that are off the page, with a box of 0 x 0, and the test filters those out. The test now finds and measures in one `page.evaluate`. Evidence: the two steps in the source of Playwright and a small script that shows 0 x 0 for elements found before a redraw; the failure itself did not come back in 20 runs under CPU load before the fix, so the interleaving is inferred, not recorded. No assertion changed.
