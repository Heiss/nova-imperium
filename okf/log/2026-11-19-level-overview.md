---
type: log-entry
date: 2026-11-19T17:50
kind: Code
issues: [187, 285, 188]
---

#187 built on the base of the Lexicanum (#285, #188 carries the design study): a ▤ next to the „?“ of every building and research unfolds the table of the next levels (the rule of the rows is D1 of the „Geklärt“ comment, the lists are buildings and research only, no sum column, the option is stored per player, the icon is the default). `users.level_table` and the migration `20261119T1733-level-table` store the option „Stufenübersicht“ (`always`, `icon`, `hidden`); `options` takes `levelTable`. [V] The table of the article and the table of the lists are one (`levelTable()` with any number of effect columns, `LevelTable.svelte`); the lists load it on demand (`LevelOverview.svelte`), since the effect of some entries lives in their lexicon file. The columns are computed from the rules of the core: what a producer makes and what it uses, the capacity of a store, the time factors (by asking `buildTime`, `unitTime` and `researchTime`, no rule repeated), the fields of the Weltenschmiede, the effect of the lexicon file where an entry has a rule of its own, and „Schaltet frei“ for an entry without a number; each value with its difference to today. `levelSteps` and the option modes moved to `src/core/level-overview.ts`; the client handler is `src/client/features/level-overview.ts`. The German texts are drafts, listed in [Level overview](/features/level-overview.md). The frozen reference of the lists got the ▤ on purpose.
