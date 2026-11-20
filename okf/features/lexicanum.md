---
type: feature
title: Lexicanum
description: The in-game lexicon (issues #285, #288, #289) - an article per catalog entry and mission computed from the rules of the game, rule pages, questions and guides, opened by the „?“ of the lists (side panel on a desktop, page on a phone), with a search, links and the shared level table of #187.
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
* **[V]** Since #187 the same table is drawn in the lists behind the ▤
  ([Level overview](/features/level-overview.md)): `levelTable()` takes any
  number of effect columns, the producer and the store effect moved to
  `src/client/logic/level-effects.ts`, `levelSteps` to the core
  (`src/core/level-overview.ts`); the article is unchanged.
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

# Stage 2: rule pages and questions (#288)

* **[E]** Stage 2 of three, its own issue, built on the article data, page,
  search and guards of stage 1; all rules as pages and questions, in
  everyday language, first how something scales, then the formula; every
  value and table from the rules (owner, 2026-11-17, „Geklärt“ of #288).
* **[V]** Taken as recommended (owner, 2026-11-17): the list of rule pages
  and the first six questions of the issue; the box „Regeln dieses
  Universums“ is replaced by a link to „Dieses Universum“, and „Hilfe &
  Optionen“ becomes „Optionen“ (B4, B9).
* **[E]** The agents draft the missing texts from the decided rules and the
  existing game terms as [V]; they ship with the update and the owner checks
  them afterwards (owner, 2026-11-19, #222).
* **[V]** Rule pages (`rule-<name>`): Kampf, Auspex-Erkundung, Flug und
  Treibstoff, Trümmerfelder und Bergung, Monde, Planeten und Felder (with
  the demolition of #202), Kolonien und Planetengrenze (#237, #224, #221),
  Produktion Energie und Lager, Bauen Forschen und Schiffsschmiede (#258),
  Schutz der Schwachen, Urlaubsmodus (#223), Sichtbarkeit und Aktivität
  (#228, #229, the play time of #231 and #232), Tagesbelohnung und Erfolge,
  Highscore (#78), Marktplatz (#171), Gilden (with friends), Endzeit and
  Dieses Universum. The first and the last five of the issue's eleven, the
  rest are the features that had no article, folded into pages by topic.
  The missions of the holding (#55), the missiles (#54), the survey (#190)
  and the expeditions (#93) keep their mission articles, which state their
  rules, and their per-round values are rows of „Dieses Universum“.
* **[V]** Questions (`faq-<name>`): the six of the issue (Gegner, Angriff,
  Flottenslots, Schlacht, Kolonie, Mine) and two more, „Wie komme ich an
  mehr Rohstoffe?“ and „Wie schütze ich mich vor Angriffen?“. Each has a
  short answer, steps or reasons as facts, a computed block where it helps
  and „Dein Stand“ with the player's numbers.
* **[V]** The start page shows the boxes „Regeln“ and „Häufige Fragen“
  before „Nachschlagen“ (a kind without a page is not shown); the search
  and „Begriffe A–Z“ cover the new pages. A word in a title counts above
  a keyword, so the question „Wie bekomme ich mehr Flottenslots?“ is found
  before the Kogitator-Doktrin for „Flottenslot“.
* **[V]** Code: a page is a `PageDef` in its own file under
  `src/core/lexicon/pages/` (id, kind, title, one line, keywords, links,
  `sections(state)`), listed in `pages/index.ts` (a guard checks the folder);
  the builders are in `src/core/lexicon/say.ts` (`say`, `formulas`, `table`,
  `facts`, `steps`), `state.ts` holds the default state of the review list.
  A text block carries its values (`values`), so its words hold no digit and
  the numbers come from the rules and the round (`LexState` has the round
  and, for „Dein Stand“, `own`, see `src/client/logic/lexicanum-own.ts`); a
  formula block carries its `Formula`s, which the guard compares with the
  rule; a table cell may be a link. The rules the pages read moved into
  `src/core` as exported numbers and functions (#214): `MAX_ROUNDS`,
  `SHIELD_IGNORED`, `EXPLODES_BELOW`, `againChance` (battle.ts), `loot.ts`
  (loot share, rebuilt defense, `plunder`, `cutLoot`, `rebuild`; the server
  imports them), `points.ts`, `PROTECTION_RATIO` and `unprotectedFrom`,
  `harvest` (debris.ts), `PER_PERCENT`, `LEVEL_REWARD`, `UNIT_REWARD`,
  `REWARD_CAP`, `LAST_RISING_DAY`, `MAX_SHIPYARD_ORDERS`, `RIGHT_TEXT`.
* **[V]** The guards (`src/core/lexicon/pages.test.ts`): every file of the
  folder is listed; no digit in a text, heading or line, every value filled
  for two very different states; every link has a target; every formula
  agrees with its rule; every setting of the universe and of the round has
  its row in „Dieses Universum“; no classic name. The review list holds
  every string of every page.
* **[V]** „Optionen“ has a line below its boxes with a link to „Dieses
  Universum“; the old box and its CSS are gone.

# Stage 2, second part: the rules the first part left out (#288)

* **[E]** The rule pages of the missions, the holding, the survey, the
  expeditions and the moon buildings were left out of the first part and
  are added by the same pattern, one page per commit (owner's brief,
  2026-11-20): a page states only what the code does, every number comes
  from the code or the round at render time, a statement the code and its
  tests cannot back is left out and reported; the texts are drafts [V]
  (owner, 2026-11-19, #222) in [Lexicanum texts](/features/lexicanum-texts.md),
  and the missions and buildings link to the page in „Siehe auch“.
* **[V]** „Raketen“ (`rule-missiles`, #54): the places of the Raketenkrypta,
  the launch, the range and flight time of `src/core/missiles.ts`, the
  impact (Abfangraketen, damage and its order, stored missiles).
  `hullOf` of `missiles.ts` is exported for the table of structures; no
  rule changed.

* **[V]** „Vermessung“ (`rule-survey`, #190): the conditions of the mission,
  the Auspex-Wert (`surveyScore`) and the four tiers of the report with what
  each shows, the bands of the orbit and the size of the rough report, the
  highest loss chance (`maxLoss`) and how long the values of a position are
  kept. `TIERS`, `NEAR_FIELDS` and `NEAR_TEMP` of `survey.ts` are exported
  (the window of ± 20 % and ± 10 °C was typed in `surveyFindings`); no rule
  changed.

* **[V]** „Expeditionen“ (`rule-expeditions`, #93): the position, the places
  and the stay (with the round's settings, from the universe `u` like the
  other live settings), the shares of the events and of the sizes, the
  find of resources and of ships, the raiders, the change of the return time
  and the settings of the round, which „Dieses Universum“ links to. `LARGE_FROM`,
  `HUGE_FROM`, `MIN_RESOURCE_POINTS`, `DIVISOR`, `resourceBase`, `RAIDS`,
  `SPREAD` of `expedition.ts` and `MIN_SHIP_FIND`, `shipBase` of
  `expedition-ships.ts` are exported; no rule changed. Left out, since the
  page would need more code to back it: the recall of an expedition.

* **[V]** „Wache stellen und Verbandsangriff“ (`rule-allies`, #55, #225): who
  may hold (the round's `allies`, read from the universe `u` like the other
  live settings), the holding times, fuel and limits of `holding.ts`, what a
  guard does in the three fights and with vacation and Mondbruch (the three
  decisions of 2026-11-19), and the union: opening, inviting, joining, the
  delay (`joinTiming`), the four limits of the round, the split of the loot
  (`splitLoot`) and the recall. No constant moved. Left out, because no test
  backs it: that the fuel of the unused holding hours is not refunded after a
  recall; and the arrival of the alliance depot, which is not built.

# Stage 3: guides and personal hints (#289)

* **[V]** The three open decisions of the issue were not answered; taken as
  recommended and consistent with the long texts of #94: D1 – Claude drafts
  the guides as [V] and the owner confirms each; D2 – the personal page is
  computed from rules only; D3 – „Erste Schritte“, the colony, the fleet and
  the defense. The owner can change any of them.
* **[V]** Guides (`guide-<name>`, kind „Einstieg“, the first box of the
  start page): „Erste Schritte“, „Deine erste Kolonie“, „Deine erste Flotte“,
  „Dich verteidigen“ and „Deine nächsten Ziele“. A guide is a list of steps
  (`steps` in `say.ts`: one fact per step, „Schritt 1“ and so on), each with
  its links and the numbers of the catalog, the universe and the round (the
  first costs, the requirements, the missions with their targets, the
  defense with its values).
* **[V]** „Deine nächsten Ziele“ is computed by `hintsOf` in
  `src/core/lexicon/hints.ts` from the state the browser holds (`own` in
  the state of a page: the shown planet, the planets, the fleets, the
  points; `src/client/logic/lexicanum-own.ts`): no new part of the server.
  Every hint is one rule of the game, never an opinion: energy that is short
  (the energy factor below one), a store that is full, no free field (on a
  planet or a moon), every fleet slot in use, the limit of planets reached
  and the research that raises it where the round has it, an entry whose only
  missing requirement is one level away (at most three, and not a building
  the shown place cannot hold), and a planet without a mine, where only the
  base income comes in. At most six hints are shown, in this order; when none
  applies the page says so.
* **[V]** The texts of the hints are templates with `{values}` and links, so
  no number is typed into them; the review list shows the page in states that
  together hold every hint (`review` of the page).
* **[V]** Tests: `hints.test.ts` tests every hint at its border; the guards
  of `pages.test.ts` run on the states of the review list too.

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
