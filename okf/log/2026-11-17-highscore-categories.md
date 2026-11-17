---
type: log-entry
date: 2026-11-17T10:49
kind: Feature
issues: [78, 222, 281, 54, 118, 242]
---

#78 built, part of the Classic features (#222): the highscore shows one ranking per category, Gesamt, Gebäude, Forschung, Flotte and Verteidigung, chosen by a row of buttons above the table (D3); the server sends the categories with every player of the state (`categoryScores` in the new `src/server/game/highscore.ts`), buildings and defense at 1 point per 1,000 resources, fleet and research by count, 1 per ship and 1 per finished level (Q1), Sonnenreliquiare as ships; the total and the noob protection stay `pointsMap`, and the categories do not add up to it, as the owner settled on 2026-11-17; defense counts only the defense that fights, so missiles stay in the total alone; the ranking, the buttons and the note live in `src/client/logic/highscore.ts` and the view stays thin, near the planet cell that the buddy list (#281) moves, so both merge easily; missiles in flight (#54) do not count in the fleet; buttons with `aria-pressed` instead of arrow-key tabs, the column „Punkte“ in every category, the note per category for buildings and defense [V]; the note for fleet and research is open [U]; the check of the hidden views moved from `src/client/main.ts` to `src/client/logic/navigation.ts`, so `main.ts` shrinks by 8 lines (#118, #242); unit and property tests of the categories (seed 78), the ranking and the view, and an E2E test that switches the category and failed without the change (see [Highscore categories](/features/highscore-categories.md)).
