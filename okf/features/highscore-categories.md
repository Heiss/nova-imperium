---
type: feature
title: Highscore categories
description: The highscore by Gesamt, Wirtschaft and Militär, visible to every player; Wirtschaft and Militär count by number or by resources, a round setting each (issue #422, replacing the four categories of #78).
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
  falls away. **Replaced by #422** (owner, 2026-11-26, 160a): see
  [Since #422](#since-422).
* **[E]** Every player sees every category (owner, 2026-11-16, D4).
* **[E]** Points as today, 1 per 1,000 resources, for buildings, defense
  and the total (owner, 2026-11-16, D5).
* **[E]** Fleet and research count as in classic (owner, 2026-11-16, Q1,
  verified): 1 point per ship, whatever it cost, and 1 point per research
  level (owiki „Statistik“, „Punkte“).
* **[E]** One tab or selector per category (total, buildings, research,
  fleet, defense), one ranking each, as in classic (owner, 2026-11-17, D3;
  owiki „Statistik“). **Replaced by #422**: one button each for Gesamt,
  Wirtschaft and Militär.
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

# Since #422

Issue #422 with its „Geklärt“ comment (owner, 2026-11-26). The owner: the
statistics showed too much, above all at the start of a round (the exact
number of ships could be read).

* **[E]** Categories: Gesamt, Wirtschaft (buildings and research) and
  Militär (fleet and defense); the four single categories go away (160a).
* **[E]** Gesamt stays resources / 1,000; the final ranking and the noob
  protection do not change.
* **[E]** Wirtschaft and Militär each count by „Anzahl“ or „Rohstoffe“, set
  separately in the round settings under „Highscore“ („Wirtschaft zählt
  nach“, „Militär zählt nach“, each „Anzahl“ or „Rohstoffen“), effective at
  once (166a); Anzahl by default for both (167a). The ranking goes by the
  value of the chosen mode, shown with the place (165b).
* **[V]** Anzahl: Militär is ships + defense units + missiles, each per
  piece; Wirtschaft is the building levels of all planets and moons +
  research levels + Sonnenreliquiare per piece. Rohstoffe: the resources
  spent / 1,000 of the same (Militär: ships, defense, missiles; Wirtschaft:
  buildings, research, Sonnenreliquiare). Ships and missiles in flight
  count until they are back or hit, as in the total.
* **[E]** The notes under the table (168a): Militär „1 Punkt pro Schiff,
  Verteidigungsanlage und Rakete.“ / „1 Punkt = 1.000 verbaute Rohstoffe
  (Flotte, Verteidigung, Raketen).“; Wirtschaft „1 Punkt pro Gebäudestufe,
  Forschungsstufe und Sonnenreliquiar.“ / „1 Punkt = 1.000 verbaute
  Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).“; Gesamt as before.
* **[E]** The round archive (171b): a new archive stores and shows Gesamt,
  Wirtschaft and Militär in the mode set at the round's end, with the notes
  of that mode; the mode is stored with each record. An old archive stays as
  it was (the four categories and their notes).
* **[E]** The Lexikon page „Highscore“ (172b): the draft of Claude, marked
  „Entwurf zur Prüfung durch den Owner“ (okf/features/lexicanum-texts.md).
* **[V]** As built:
  * `src/core/highscore-categories.ts`: the categories, the modes
    (`categoryModes` of the round, a missing value Anzahl) and the notes;
    `src/core/highscore-passes.ts`: the two settings, numbers 0/1 with the
    choices „Anzahl“ and „Rohstoffen“ (orders 490 and 500), `live`.
  * `server/game/scores.ts`: the one pass (#405) computes both modes of
    each category; a Sonnenreliquiar (the ship that does not fly) counts to
    Wirtschaft, every other unit to Militär; Gesamt is the resources of both
    together. The state (`players[id].scores`) sends `{economy, military}`
    in the mode set now, so a change of a setting shows at the next state
    from the same pass; it carries no value of the four old categories.
  * `server/game/round-archive.ts` writes `{total, economy, military,
    modes}`; `core/round-report.ts` reads both shapes (`isCoarse`,
    `valueOf`); `client/logic/round-archive.ts` shows the buttons and notes
    of the shape (a report without participants keeps the old five [V]);
    the participant drilldown names Wirtschaft and Militär, or the four.
  * The round-rewind keeps its own words of the investment (Aufbau,
    Forschung, Flotte, Verteidigung), from its own facts.

## „Highscore zeigt“ (#422, owner, 2026-11-26, 175a to 182a)

* **[E]** A round setting „Highscore zeigt“ under „Highscore“ with „alle
  Wertungen“ (0, default), „nur Gesamt“ (1) and „nichts“ (2); a change takes
  effect at once (180a). Texts 181a.
* **[E]** „nur Gesamt“ (177a): the state carries only the total, no
  Wirtschaft or Militär; the highscore shows Gesamt only. The settings of
  Wirtschaft and Militär stay without effect. Übersicht, Sternenkarte and
  guild unchanged.
* **[E]** „nichts“ (176a, 182a): the server sends no points, rank or
  category of another player; the own points stay (Übersicht „Punkte: X“
  without a place; the Lexikon hints as before). The Highscore page and its
  menu entry are hidden, so is its „Stand“; the ranks of the Sternenkarte
  and the points and point sums of the guilds go away, with their „Stand“
  (#494). The final ranking and
  the round end are computed in full.
* **[E]** The „(n)“ stays in every mode (179a); the round archive shows
  finished rounds in full (178a).
* **[V]** As built:
  * `core/highscore-passes.ts`: the setting (order 485, before „Wirtschaft
    zählt nach“); `core/highscore-categories.ts`: `SHOWS`,
    `highscoreShows` (an unknown value is „alle Wertungen“),
    `highscoreOffered`.
  * `server/game/state.ts` (`playersOf`): `points` of another player only
    while the highscore shows something, `scores` only with every
    category; `players[id].points` is optional in `core/state/frame.ts`.
  * `server/game/guilds.ts`: with „nichts“ the members without points and
    the guild without `score` and `average`, the list by tag
    (`core/state/guilds.ts` optional fields).
  * Client: the view „Highscore“ carries `offered: highscoreOffered` (menu,
    tabs, address and mount hide it, for players and the admin alike);
    `logic/highscore.ts` shows the Gesamt button alone with „nur Gesamt“;
    `logic/overview.ts` drops the place; `logic/galaxy.ts` gives no rank and
    `Galaxy.svelte` leaves out „(Platz …)“; `logic/guilds.ts`, `Guilds.svelte`
    and `GuildMembers.svelte` leave out the columns and the box „Punkte“.
  * Foreign points or ranks elsewhere in the client: none. The round archive
    and its Rewind read archived rounds (178a, in full); the provisional
    report of the running round and its drilldown are the admin's
    („Rundenberichte“) and read the facts in full, so the admin sees all
    points there [V]; the admin panels show no points.


