---
type: log-entry
date: 2026-11-24T19:00
kind: Feature
issues: [356, 189]
---

„Optionen“ shows the switch of its five sections on every width (#356; owner, 2026-11-22: it replaces D6 of #189 for this page): the desktop shows the boxes of one section at a time, with the same switch as a phone (`div.seg.opt-seg`, a group of buttons with `aria-pressed`). The names and the grouping of the sections, and whether the chosen section is kept over a reload or in the address, stay open [U]; no link of the game opens a box of „Optionen“ directly. E2E: `optionsSection` of `e2e/helpers.ts` chooses the section on every width; the desktop flows of `a11y`, `accounts`, `error-log` and `playtime` choose it now too. Changed existing tests: the expected class of the switch (`seg phone-only` → `seg opt-seg`) in `src/client/views/options.test.ts` and `src/test/options-reference.test.ts`.
