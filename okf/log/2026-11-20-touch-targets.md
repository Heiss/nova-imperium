---
type: log-entry
date: 2026-11-20T23:00
kind: Decision and code
issues: [189, 237]
---

Owner, 2026-11-20 (#189): every interactive element of the phone views is at least 44 px. The last block of `style.css` (phone, up to 760 px) gives every button (the former `small` ones, „?“ and „▤“, the arrows of the Sternenkarte), select, text field and `summary` a height of 44 px, a button a width of 44 px, and the list links of the Lexicanum (lists, see-also, crumbs, the table of contents) 44 px both ways; a link inside a sentence and a check box or radio button (through its label) are exempt. Before: plain buttons 30 px, `small` buttons 23 px, „?“ and „▤“ 24x24, the arrows 29x23, fields 31 px, selects 33 px, Lexicanum links 21 px. `e2e/touch-targets.spec.ts` measures all views, a guild page, an article, every admin tab and „Mehr“, and passes without an expected-fail marker. #237: at the highest level of the Kolonialverwaltung the research row shows „höchste Stufe erreicht“ instead of the button „Forschen (Stufe N+1)“ (`researchAction` in `src/client/logic/catalog-list.ts`, unit test there, `e2e/planet-limit.spec.ts`); the server still refuses a further level. See [Interface](/features/interface.md).
