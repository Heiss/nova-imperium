---
type: log-entry
date: 2026-11-19T23:30
kind: Code
issues: [118, 78, 53, 220, 189, 242]
---

#118, bundle 5, first part (the order of the bundles of „Geklärt, Nachtrag 3“, unchanged by „Nachtrag 4“): „Highscore“ and „Achievements“ are Svelte components; „Hilfe & Optionen“ (now „Optionen“) follows in its own part. `Highscore.svelte` renders `highscorePage()` of `logic/highscore.ts` (the categories of #78, the table with the home planet that is never a moon, #53, and the note), `Achievements.svelte` renders `achievementsPage()` of the new `logic/achievements.ts` (the daily reward of #220, the filter and the three groups with the phone fold of #189, which keeps its behaviour). Both are mounted anew on every render as their HTML was, registered in `views/mount.ts` and removed from `VIEWS` [V]. The markup is that of the HTML views, so the phone rules for `.scores` and the fold and the filter of `features/achievements.ts` keep working. Two property tests keep the components equal to the frozen HTML (300 states each, seed 118) with hand-built cases for the rare marks; `normalize()` of `src/test/markup.ts` now also reads the marks of the achievements without their empty value. `main.ts` stays at 1,191 lines (the limit of #242): neither view had code in it. No visible change (the label `kein-changelog`, no fragment); see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md).
