---
type: feature
title: Highscore categories
description: The highscore by Gebäude, Forschung, Flotte and Verteidigung besides the total, visible to every player; fleet and research count ships and levels as in classic (issue #78).
---

# Highscore categories

Issue #78, part of the Classic features (#222). The total points and the
noob protection stay as they are. The owner's answers of 2026-11-16 to D1,
D4, D5 and Q1. Sources: owiki.de „Statistik“
(https://owiki.de/index.php?title=Statistik&oldid=78842) and „Punkte“
(https://owiki.de/index.php?title=Punkte&oldid=78837).

# Decisions

* **[E]** Categories (owner, 2026-11-16, D1): buildings, research, fleet,
  defense and the total. No category „resources“, so its meaning (D2)
  falls away.
* **[E]** Every player sees every category (owner, 2026-11-16, D4).
* **[E]** Points as today, 1 per 1,000 resources, for buildings, defense
  and the total (owner, 2026-11-16, D5).
* **[E]** Fleet and research count as in classic (owner, 2026-11-16, Q1,
  verified): 1 point per ship, whatever it cost, and 1 point per research
  level (owiki „Statistik“, „Punkte“).
* **[E]** One tab or selector per category (total, buildings, research,
  fleet, defense), one ranking each, as in classic (owner, 2026-11-17, D3;
  owiki „Statistik“).
* **[E]** The categories do not add up to the total: the acceptance
  criterion „all categories add up to the total“ is dropped (owner,
  2026-11-17). The total stays resources / 1,000 (D5), fleet and research
  rank by count (Q1).
* **[E]** Demolishing a building level lowers the points by the cost of
  that level, at 1 point per 1,000 resources (owner, 2026-11-16, #202 D6; see
  [Demolition](/features/demolition.md)).

# Proposals

* **[V]** As in classic, Sonnenreliquiare (solar satellites) count as
  ships, and missiles ([Missiles](/features/missiles.md)) count only in the
  total (owiki „Statistik“, „Punkte“).

# Built (2026-11-17)

* The server sends the categories with every player of the state
  (`players[id].scores`, `categoryScores` in
  `src/server/game/highscore.ts`); the total stays `pointsMap` of
  `points.ts`, so the noob protection does not change. Buildings count
  every planet and moon, rounded down per category; fleet counts the ships
  on planets and moons and in flight, by the keys of the ships only;
  defense counts the defense that fights (`FIGHTERS`), so a missile (#54)
  stays out of it once it exists; research counts the finished levels.
* **[V]** The selector is a row of five buttons above the table, „Gesamt“
  first and pressed until another is chosen (`aria-pressed`, a group
  labelled by the heading „Highscore“), not the arrow-key tabs of the admin
  view; the choice lasts while the page is open (`src/client/logic/highscore.ts`,
  the view stays thin for #118).
* **[V]** The column „Punkte“ keeps its name in every category. The note
  below the table keeps its sentence for the total and names the category
  for buildings and defense: „1 Punkt = 1.000 verbaute Rohstoffe
  (Gebäude).“ and „… (Verteidigung).“
* **[E]** The note under Flotte reads „1 Punkt pro Schiff (auch
  Sonnenreliquiare).“, under Forschung „1 Punkt pro Forschungsstufe.“
  (owner, 2026-11-17).
