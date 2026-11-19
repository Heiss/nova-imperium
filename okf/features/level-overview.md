---
type: feature
title: Level overview
description: A second icon next to the „?“ of every building and research unfolds a table of the next levels with cost, time, effect and the difference to today; an option per player shows it always, as an icon or not at all (issue #187).
---

# Level overview

Issue #187 („Geklärt“, owner, 2026-11-14; milestone next release, label
`ready`). A player saw only the cost of the next level; planning two or
three levels ahead needed a calculator. The table shows what the next levels
of a building or research cost, how long they take and what they bring.

# Decisions

* **[E]** A second icon „▤“ next to the „?“ of the explanation texts (#63,
  Lexicanum #285) unfolds the table; an option shows it always, as the icon
  or not at all (owner, 2026-11-14).
* **[E]** D1, the rows: the next 3 levels, then the multiples of 5 above
  them up to 20; above 20 the next 3 levels and the next multiple of 5
  (level 3 → 4, 5, 6, 10, 15, 20; level 21 → 22, 23, 24, 25; level 22 → 23,
  24, 25, 30).
* **[E]** D2: buildings and research only; ships and defense get no table.
* **[E]** D3: no column with the total cost from today up to a level.
* **[E]** D4: the option is stored per player on the server, like the
  explanation option of #63.
* **[E]** D5: new players get the icon „▤“.
* **[E]** Per level: what it costs and what its effect brings, with the
  difference to today; one pure function computes the rows, server and
  browser use the same formulas.
* **[V]** The table and the article of the Lexicanum (#285) are the same
  table: `src/client/logic/level-table.ts` computes it, one component draws it
  (`LevelTable.svelte`), and the lists take the cost and time of their next
  level from the same `levelRow()`. The rule of the rows and the modes of the
  option are in the core (`src/core/level-overview.ts`: `levelSteps`,
  `LEVEL_MODES`, `levelMode`).

# Built [V]

* **Option.** `users.level_table` (`always`, `icon`, `hidden`, CHECK, `NOT
  NULL DEFAULT 'icon'`), migration `20261119T1733-level-table`
  (`src/server/db/migrations/187/migrations.ts`, upgrade test
  `upgrades/20261119T1733-level-table.test.ts`); every existing player gets
  the icon. The action `options` takes `levelTable` next to `probes` and
  `explain`; a value that is none of the three is refused („Ungültig.“), and
  an older client that sends none keeps the stored one. The state sends it as
  `me.levelTable`. In „Hilfe & Optionen“ it is a second selection under the
  one of the „?“ with the same „Speichern“.
* **The icon.** Buildings and research rows show the ▤ button after the „?“:
  `data-act="levels"`, `aria-expanded`, `aria-controls` while unfolded,
  the name „Stufenübersicht zu ‹Name›“ (`logic/level-mode.ts`: `levelsRow`).
  The handler `levels` is the client feature `src/client/features/
  level-overview.ts`; it toggles `client.ui.openLv` (kept while the page is
  open, not stored). In „Immer anzeigen“ there is no button and every table
  is in its row; in „Ausblenden“ neither.
* **The table loads on demand.** `CatalogList.svelte` imports
  `LevelOverview.svelte` only when a table is shown, because the effect of
  some entries is stated in their lexicon file, which stays out of the start
  bundle ([Lexicanum](/features/lexicanum.md)). `logic/level-overview.ts`
  (`overview()`) assembles the table; the rows come without the own level
  (the article keeps it, marked), each effect with its difference to today,
  the separator „große Schritte“ before the first big step, and notes below.
* **What a level brings** (columns after „Kosten“ and the time), all from the
  rules of the core on the shown planet and universe
  (`logic/level-effects.ts`):
  * producers: what they make per hour at full share and with enough energy
    (`produces`, a resource times the universe speed as `prod()` adds it);
  * what they use: the energy need and the resources they burn (`consumes`),
    shown as a cost (a rise is red, a fall green);
  * stores: the capacity (`capOf`);
  * the Servitorenschmiede, Machina-Schwarmhalle, Schiffsschmiede and
    Scholarium: the time factor on the building time, the time of a shipyard
    order or the research time, from asking `buildTime`, `unitTime` and
    `researchTime` with one building at the level (no rule is repeated);
  * buildings with `fields` (Weltenschmiede): the fields they add
    (`maxFields`);
  * the entries with a rule of their own (fleet slots, expeditions, linked
    Scholarien, fields of the moon, range of the Auspex-Phalanx, the bonus of
    weapons, shield and armour, the drives): the effect of their lexicon file,
    the same value as in the article;
  * an entry without any number: „Schaltet frei“, the entries whose
    requirement lies on the levels since the row before
    (`opened()` in `src/core/level-overview.ts`); no column when a table opens
    nothing.
* **Phone.** The table scrolls sideways inside the entry, as in the article
  (a focusable region, so the keyboard reaches it).

# Texts [V]

Drafted by Claude from the issue, the mockup (`docs/design/level-table/`),
the decided rules and the game terms; the owner checks them later.

* Button: „Stufenübersicht zu ‹Name›“ (from the issue).
* Option: „Stufenübersicht:“ with „Immer anzeigen“, „Als ▤-Symbol“,
  „Ausblenden“ (from the issue).
* Headings: „Stufe“, „Kosten“, „Bauzeit“ or „Forschungszeit“ (as the
  lists); each effect with „ (Δ zu heute)“ after its label, so „Flottenslots
  (Δ zu heute)“; the separator „große Schritte“; „Schaltet frei“ and „–“ for
  a row that opens nothing.
* Effect labels that are new: „Energiebedarf“, „Adamantverbrauch/h“,
  „Psikristallverbrauch/h“, „Promethiumverbrauch/h“, „Gebäude-Bauzeit“,
  „Einheiten-Bauzeit“, „Forschungszeit“ (for the Scholarium), „Zusätzliche
  Felder“. The labels of the Lexicanum stay (owner, 2026-11-17).
* A factor reads „×0,5“, a bonus „+30 %“, a difference „+280“ or „−19“.
* Notes below a table: „Bauzeiten mit deiner heutigen Servitorenschmiede und
  Machina-Schwarmhalle.“ for a building; „Forschungszeiten mit deinem
  heutigen Scholarium und dem Sternennetz der Gelehrten.“ for research
  (the research time counts the linked Scholarien, #49); „Die Förderung setzt
  genug Energie voraus; fehlt sie, sinkt sie mit dem Faktor der Energie.“ at
  a mine (the wording of the mockup); „×1 ist die Zeit ohne diese
  Gebäudestufe.“ at a time factor.

# Tests

* `src/core/level-overview.test.ts` (the row rule for the levels 0, 3, 16,
  17, 19, 20, 21, 22 and 47 and its invariants, the modes, `opened`);
* `src/client/logic/level-table.test.ts` (rows, differences, the first big
  step, the texts of values and differences), `level-effects.test.ts` (each
  effect against the formula of the core it comes from), `level-overview.test.ts`
  (the table of a mine, a research, a time factor, a store, an entry without
  a number), `level-mode.test.ts`, `src/client/features/level-overview.test.ts`
  and `options.test.ts` (handlers with the fake context);
* `src/client/views/catalog-list.test.ts` and
  `src/test/catalog-list-reference.test.ts` (the ▤ and the box of the table in
  the markup of the lists; the frozen reference got the ▤ on purpose, with
  hand-built cases for the three modes);
* `src/server/game/actions.test.ts`, `src/server/db/store.test.ts`,
  `repos/players.test.ts` and the upgrade test of the migration.

Worth adding as E2E (Playwright, desktop and phone): unfold and fold the
table with mouse, touch and keyboard (`aria-expanded`); switch the option
to „Immer anzeigen“ and „Ausblenden“ and keep it after a reload; the table
of a mine, of the Waffensegnung and of the Servitorenschmiede with the
numbers of the formulas; axe on the buildings and research views with a
table open.
