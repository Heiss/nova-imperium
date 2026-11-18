---
type: log-entry
date: 2026-11-17T16:37
kind: Feature
issues: [285, 187, 63, 214, 242, 118, 287]
---

#285, stage 1 of the Lexicanum (owner's „Geklärt“, 2026-11-17): an article for each of the 52 catalog entries and the 6 missions, generated from the catalog, its texts and the mission rules, with the long text `lt` as the introduction; the level table of #187 (`levelRow`, `levelTable`, `LevelTable.svelte`), whose cost and time the lists now take for their next level; requirements in both directions; „Was die Stufen bringen“ computed from the rules where the effect is a rule of the level, with formulas checked against the rule (B8). The „?“ of #63 opens the article in a side panel on a desktop and the page on a phone; the option has two values, a stored „Immer anzeigen“ reads as „Anzeigen“ (B2). A search on the page (B6), links `[[id]]` (B7), the menu entry „Lexicanum“ (B9) and the address `?view=lexicanum&a=…`. The rules of the Auspex-Erkundung moved into `src/core/spy.ts` (#214); the page and the panel load as their own chunk and `src/client/main.ts` shrinks to 1878 lines (#242, #118). Texts of the design study #287 [V] (see [Lexicanum](/features/lexicanum.md)).
