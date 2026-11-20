---
type: log-entry
date: 2026-11-20T05:00
kind: Code
issues: [304, 288]
---

Mutation score of the Lexicanum files raised to their floors (#304; the floors are written only from the CI report, none was touched). Only tests changed, no game rule, text or behaviour. The guards of the written pages (`pages.test.ts`, #288) now also check that every formula has at least one sample with a value for each parameter of its function, and that no page, address, heading, caption, label or table cell is empty; hand-built tests fix the tables, stands and links of the pages `rule-vision`, `rule-rewards`, `rule-colonies`, `rule-universe`, `faq-intel` and `guide-colony` (`pages.blocks.test.ts`, `pages.universe.test.ts`, `pages.rewards.test.ts`; the last two replace a registry or a list by one made for the test), the builders of `say.ts` and `targets.ts` (`say.test.ts`), the words of a page for each review state (`docs.test.ts`), the exact markup of the battle and espionage report bodies (`report-body.test.ts`) and what an article holds and leaves out (`lexicanum.test.ts`). The local single-file runs of Stryker gave 94 to 100 % for the files of the task and for the pages `missiles`, `survey`, `expeditions`, `allies`, `gates` and `parts`, which the CI measures as new files.
