---
type: log-entry
date: 2026-11-27T07:10
kind: Fix
issues: [432, 302, 418]
---

The phone E2E test „a name of 20 wide letters stays left of the points on the highscore“ failed once in part 4 of #432, a pull request of documentation only, with `stand!.y` of null. Its cause was not a setting of another spec: `e2e/highscore-passes.spec.ts`, which changes the shared settings of the highscore, is not in part 4, and the specs of one part run one after another (#302). The view „Highscore“ is mounted anew on every render (`anew`), the poll's too, every 4 seconds, and the test measured „Stand“ and the table with two calls of `boundingBox()`; a render between them detaches the node, which then measures null. Shown locally: a node of „Stand“ kept over `pollRender` is no longer connected and measures null. The new helper `boxes(page, ...selectors)` of `e2e/helpers.ts` reads every box in one call in the page, after „Stand“ is visible; the assertion that „Stand“ stands above the table on a phone stays, and so does the one of the desktop test in `e2e/highscore-passes.spec.ts`, which measured the same way (#418).
