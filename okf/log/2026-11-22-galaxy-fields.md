---
type: log-entry
date: 2026-11-22T02:00
kind: Code
issues: [352, 347, 118, 332]
---

Fix of #352 (a rare red E2E job of #347, `e2e/redraw-drafts.spec.ts`, the system „65“ with a typed „1“ became „651“): the Sternenkarte was mounted anew on every render (#118), so a render that is not fresh (the news, the poll, the clock) replaced the fields „Galaxie“ and „System“; the new field got the focus back by its id, but with the value of the page and the caret at the end, so a selection made just before was lost and the next digit was appended. The view now says `fresh` (`ClientView`, `src/client/views/contract.ts`): a fresh render still mounts it anew and drops the typed position (#332), any other render hands the mounted component the new page (`update`, `GalaxyView.svelte`), so the fields stay the same elements. `mountsAnew()` of `src/client/views/mount.ts` is the one rule of `render.ts`. Tests: `e2e/galaxy-fields.spec.ts` (select, a render of the news or the poll, then insert: exactly what was typed; failed on the code before), the focus over such a render and the countdown of the scan over a poll render (`e2e/phalanx.spec.ts`; both passed before and after), and the unit tests of the registry and of the Sternenkarte. One existing test changed, by the coordinator's decision [V] (2026-11-22, reported to the owner): `e2e/redraw-drafts.spec.ts`, the case „the position of the Sternenkarte keeps what was typed until Enter“, told the poll render by the replacement of the field `#g_g` (`waitForRedraw`), which the fix stops; it now seeds a colony on slot 15 of the shown system and waits until the map shows it, so the render with the new state reached the Sternenkarte itself. Its assertions are unchanged, and it fails when the drafts are dropped by a render that is not fresh (checked with a temporary change).

Not changed (the scope of the fix is the Sternenkarte): the other views mounted anew with typed fields are exposed the same way, listed in the issue.
