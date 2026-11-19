---
type: feature
title: Lexicanum
description: The in-game lexicon of stage 1 (issue #285) - an article per catalog entry and mission computed from the rules of the game, opened by the „?“ of the lists (side panel on a desktop, page on a phone), with a search, links and the shared level table of #187.
---

# Lexicanum

Issue #285, stage 1 („Geklärt“, owner, 2026-11-17, label `ready`). Design
study: draft pull request #287 (branch `claude/lexicon-study`, never
merged). Stage 2 (rule pages and questions, replacing the box „Regeln
dieses Universums“) and stage 3 (guides and personal hints) are issues of
their own.

# Decisions

* **[E]** B1 – the name is „Lexicanum“ (owner, 2026-11-17).
* **[E]** B2 – the option of #63 has two values, show the „?“ or hide it;
  „Immer anzeigen“ goes. **[V]** The label is „(?)-Symbol: Anzeigen /
  Ausblenden“; a stored `always` reads as `icon`, `hidden` stays; with the
  symbol hidden the Lexicanum is reached through the menu.
* **[E]** B3 – three stages, each its own issue; this is stage 1: the
  articles of all catalog entries and missions, the side panel, the page,
  the search, the shared level table.
* **[E]** B5 – the own level at the head, the row that applies marked, and
  „Dein Stand: …“ with the player's numbers.
* **[E]** B6 – the search finds names, abbreviations, the text of the
  articles and keywords per article in everyday words that are not shown;
  no classic names. The search is on the page only.
* **[E]** The „?“: on a desktop it opens the article as a side panel in
  place of the text below the entry; the panel links to the article on the
  page and has no search. On a phone it opens the page itself.
* **[E]** Everyday language, first how something scales, then the formula;
  `lt` is the introduction of an article.
* **[E]** The tables are the same as in the lists, computed from the rules;
  the tables of the lists stay.
* **[V]** B7 – links are written by hand as `[[id]]` / `[[id|text]]`; a test
  fails on a link without a target.
* **[V]** B8 – a formula is a block with its text and a small function; a
  test compares it with the rule on sample values.
* **[V]** B9 – a menu entry „Lexicanum“ before „Hilfe & Optionen“, on a
  phone under „Mehr“; „Hilfe & Optionen“ keeps its name in stage 1.
* **[V]** The address is `?view=lexicanum&a=<article>`; the page and the
  panel load as their own chunk when first opened (#242).
* **[E]** The gaps of the build (owner, 2026-11-17, „Geklärt“ on the build
  on `claude/lexicanum`): Claude drafts the words before the formulas for
  the articles without a source, a short text per mission (what happens on
  arrival) and keywords in everyday words per article, all as [V] for the
  owner to confirm or change, as with #94; the review list is
  [Lexicanum texts](/features/lexicanum-texts.md). The labels the builder
  chose are confirmed (see „Texts“). The level table of a producer keeps
  the rate at full energy, and its column heading says „bei voller
  Energie“.
* **[E]** Kept up to date by Claude: a pull request that changes a rule or
  adds a catalog entry or a mission updates its article
  ([Release loop](/ops/loop.md)).

# Code

* **[V]** Rules where the browser can read them (the direction of #214):
  `src/core/spy.ts` holds `SPY_LEVELS`, `spyScore` (moved from the server
  part of the mission „Auspex-Erkundung“, which imports them) and
  `spyParts`, `probesFor`; the chance of the Auspex-Abwehr (`counterMax` and
  its numbers) is in `src/core/espionage.ts` (#175), which the article reads; `src/core/battle.ts` exports
  `TECH_BONUS` and `techFactor`, which the lists use too.
* **[V]** Articles as data in `src/core/lexicon/`: `articles.ts` (one
  article per entry of `BUILD`, `RES`, `SHIPS`, `DEF` and per mission of
  `MISSION`, id `mission-<m>` since `spy` is both; requirements in both
  directions), `links.ts`, `search.ts`, `docs.ts` (headings and the search
  documents), `parts.ts` (shared parts and the formulas of cost and store
  capacity), `types.ts`. Nothing there names a catalog key.
* **[V]** An entry adds to its article in its own folder,
  `src/features/<key>/lexicon.de.ts` (`lexicon`: keywords, „Siehe auch“,
  the effect of a level, texts, formulas, computed blocks), and a mission
  in `src/features/missions/<m>/lexicon.de.ts` (keywords and its text).
  Every entry and every mission has one since 2026-11-17.
  `scripts/gen-features.ts` lists these files in their own generated
  index `src/features/lexicon.gen.ts` (`LEXICON` and `MISSION_LEXICON`,
  not checked in), which
  only `src/core/lexicon/` may import (`.dependency-cruiser.cjs`,
  `lexicon-index-in-lexicon`), so they stay out of the start bundle.
  Stryker leaves `lexicon.de.ts` out like the text files; their formulas
  are checked by the guards.
* **[V]** Parts of stage 1: Auspex-Lehre (report levels, Spähschädel
  needed by lead, chance of the Auspex-Abwehr, „Dein Stand“), Kogitator-Doktrin (fleet slots),
  the three drives (speed bonus), Waffensegnung, Refraktionsfelder and
  Adamant-Panzerung (bonus in battle), Sternennetz der Gelehrten (linked
  Scholarien), Auspex-Phalanx (range), Mondzitadelle (fields), Warp-Tor (cooldown by the
  level of the starting gate, divided by the universe speed; its table is a
  computed block, #230, #293). Stores get
  their capacity and producers their rate per level from their components
  (`storage`, `produces`); their files hold the words before it. The
  shared texts are built in `src/core/lexicon/parts.ts`: `drivePart`,
  `techPart`, `storePart`, and the values `growthValues` of the producers
  that grow like a mine.
* **[E]** The rate of a producer in the level table is the rate at full
  share and with enough energy, and the heading says so: „Adamant/h bei
  voller Energie“, „Psikristall/h bei voller Energie“, „Promethium/h bei
  voller Energie“ (owner, 2026-11-17). Sonnenkathedrale and Fusionssanktum
  keep „Energie“ [V].
* **[V]** The level table of #187: `levelSteps`, `levelRow` and
  `levelTable` in `src/client/logic/level-table.ts`, drawn by
  `src/client/views/LevelTable.svelte`. The lists take the cost and time of
  their next level from `levelRow`; the article shows the own level first
  (marked) and then the levels of #187 D1. Rows above 20: the next 3 and the
  next multiple of 5; for 17 to 19 the steps up to 20 are empty, so the
  next multiple of 5 above them follows, as above 20.
* **[V]** `src/client/logic/lexicanum.ts` builds the pages and the article
  with the player's state (`articleView`, `page`, `crumbs`, the search
  helpers); `src/client/logic/address.ts` the addresses (also `viewUrl`,
  moved out of `main.ts`).
* **[V]** Views: `LexicanumPage.svelte` (path, search, start page with
  „Nachschlagen“, lists, the article with „Auf dieser Seite“ and the
  articles of its kind), `LexicanumPanel.svelte`, `LexicanumArticle.svelte`
  (the same article in both), `LexicanumSearch.svelte` (a combobox: ↑ ↓
  Enter Esc, „/“ focuses it), `LexicanumText.svelte`. The part in the
  start bundle is `src/client/views/lexicanum.ts`,
  `lexicanum-nav.ts` and `lexicanum-state.svelte.ts`: the actions `nav`, `explain`, `lex`,
  `lexPanel`, `lexClose`, the lazy mount of page and panel. The panel
  closes with Esc, „Schließen“, the same „?“ or when its list is left; the
  focus goes back to the „?“. `main.ts` shrinks from 1888 to 1878 lines.
* **[V]** Mission articles show their text (what happens on arrival), the
  typed data of their rules (target, cargo, return, visible, own report)
  and the ships the mission takes,
  found by its own `canSend` („nur Spähschädel“, „braucht
  Kolonistenarche“); a ship links the missions that need it.

# Texts

* **[V]** The texts of the article of the Auspex-Lehre are those of the
  design study (#287), with the numbers as values from `spyScore`. The
  headings and labels are the texts of the study listed in the issue.
* **[V]** Keywords: „ausspähen“ and „Gegner“ at the Auspex-Lehre (the
  examples of the issue), and since 2026-11-17 a few everyday words for
  each of the 52 entries and 6 missions, drafted by Claude: one word each,
  no classic name. **[E]** Everyday words that are stems of classic names
  stay („angreifen“, „Speicher“, „Tank“, „Triebwerk“, „Laser“, „Kanone“),
  and parts of the title are allowed („Mond“ at the Mondzitadelle, „Sonne“
  at the Sonnenkathedrale) (owner, 2026-11-17, on pull request #291).
* **[V]** The words before the formulas, drafted by Claude (2026-11-17):
  Kogitator-Doktrin, the three drives, Waffensegnung, Refraktionsfelder
  and Adamant-Panzerung, Sternennetz der Gelehrten, Auspex-Phalanx,
  Mondzitadelle, Warp-Tor, the three stores, and the producers Adamant-Tiefbohrung,
  Psikristall-Steinbruch, Promethium-Raffinerie, Sonnenkathedrale and
  Fusionssanktum. First how it scales, in the style of the Auspex-Lehre;
  every number is a value from the rules.
* **[V]** The text of each of the 6 missions, drafted by Claude
  (2026-11-17): what happens on arrival, from its rules and its
  `arrive.server.ts`. It is shown above the facts. **[E]** The line below
  the hit of the mission in the search is only its first sentence
  (`firstSentence` in `src/core/lexicon/docs.ts`; owner, 2026-11-17).
* **[V]** The missiles of #54 (Raketenkrypta, Abfangrakete, Orbitalrakete)
  have keywords only, and the mission Raketenangriff has its text, drafted
  by Claude (2026-11-18) from `src/core/missiles.ts` and its
  `arrive.server.ts`; all in the review list
  ([Lexicanum texts](/features/lexicanum-texts.md)).
* **[E]** The drafts go into the game as [V]; the owner changes them later
  in the review list (owner, 2026-11-17).
* **[V]** All these drafts are listed for the owner, per article, in
  [Lexicanum texts](/features/lexicanum-texts.md); a guard keeps the list
  equal to the texts in the code.
* **[E]** The labels the builder chose are confirmed (owner, 2026-11-17):
  the facts of a mission
  („Ziel“, „Ladung“, „Rückflug“, „Eigener Bericht bei der Heimkehr“, „Schiffe“; the
  fact „Für den Verteidiger sichtbar“ is gone since #228, because no
  mission has a `visible` field any more: every foreign fleet follows the
  Auspex-Lehre of the defender, see
  [Espionage defense](/features/espionage-defense.md); a replacement
  line is an open question of the owner [V]), the effect columns („Flottenslots“,
  „Tempo“, „Angriff“, „Schild“, „Struktur“, „Weitere Scholarien“,
  „Reichweite“, „Felder des Mondes“, „Lagerkapazität“, „Adamant/h“ …),
  „Grundwert“ and „Grundtempo“ in the formulas, and „· deine Stufe“ at
  the own level.

# Tests

* Guards (`src/core/lexicon/articles.test.ts`): every catalog entry and
  mission has an article; every link has a target; no digit in a text of
  an article outside a formula; every value filled; every formula agrees
  with its rule; no classic name; every article has at least two
  keywords, each one word and no classic name; every mission has one
  text, whose first sentence is its search line; every article with an
  effect, every store and every producing building has words before the
  formula; the review list holds every draft as the code has it.
  `parts.test.ts` checks the values of the shared texts and the formulas of
  cost and store for every entry; `docs.test.ts` checks the search
  document (`searchDoc`), `hasEffect` and `firstSentence` on articles made
  for the test, since every real entry has all its parts; `search.test.ts`,
  `links.test.ts`, `src/core/spy.test.ts`.
* `src/client/logic/level-table.test.ts` (the rows of #187 D1, the same
  cost and time as the next level of the list), `lexicanum.test.ts`,
  `address.test.ts`, `explain.test.ts`.
* E2E `e2e/lexicanum.spec.ts`: the panel on a desktop (focus, Esc,
  keyboard, „Schließen“, „Im Lexicanum öffnen“), links, the address after a
  reload and „back“, the search by name, abbreviation, text and keyword
  with ↑ ↓ Enter Esc and „/“, the own level and „Dein Stand“, the option,
  the page on a 360 px phone, axe. `a11y.spec.ts` and
  `phone-overflow.spec.ts` include the view.
