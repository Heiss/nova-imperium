---
type: Architecture
title: '2. Texts apart from rules'
description: 'Display texts live in their own files per entry, apart from the rules, so a renaming or a long explanation touches no rule.'
---

# 2. Texts apart from rules

* **[E]** Name, abbreviation, short and long description of an entry live in
  its own text file (`texts.de.ts`), keyed by the entry key. Rules contain
  no German text. Renaming (#94) and explanations (#63) then never touch a
  rule file.
* **[V]** First step (#131, owner 2026-11-12: display texts are not
  mutation-tested): the display texts of the catalog and the mission names
  are in `src/core/texts.ts`, keyed by the entry key, and each catalog
  entry spreads its texts; Stryker leaves the file out (see
  [Test strategy](/ops/testing.md)). The per-feature `texts.de.ts` follow
  with the folder skeleton.
* **[E]** #113 builds on `src/core/texts.ts` of #131 (all display texts
  in one data file that Stryker leaves out): after #112 it splits that file
  into one `texts.de.ts` per entry and adds the accessor `text(key)`; the
  text files stay out of the mutation run (owner, 2026-11-13).
* **[E]** Decided for #113 (owner, 2026-11-13): the mission names stay in
  `src/core/texts.ts`, still left out by Stryker, until #116 moves them into
  the mission folders; `text(key)` covers the catalog entries only (`spy` is
  both a research and a mission). The 12 classic ships and defenses that
  never had a short text get one in #113 (see
  [Grimdark naming](/features/naming.md)); after that every entry needs a
  name, an abbreviation and a short text.
* **[E]** Built with #113: every entry folder holds `texts.de.ts` beside
  `entry.ts`; `scripts/gen-features.ts` stops on an entry folder without
  either, and lists the text files as `TEXTS` in the generated index beside
  `ENTRIES`. `src/core/text.ts` holds the type `EntryText` (`n`, `ab`, `ds`,
  optional `lt`) and `text(key)`, undefined for a key that is no entry;
  server and browser read every name, abbreviation, short and long text
  through it, and `BuildingDef`, `ResearchDef`, `ShipDef` and `DefenseDef`
  hold no text. Stryker leaves `src/features/**/texts.de.ts` out like
  `src/core/texts.ts`; `src/core/text.ts` is mutated.
  `src/core/text.test.ts` fails on a missing name, abbreviation or short
  text, an abbreviation used twice, a text file without an entry and a text
  field in a rule.
* **[E]** Choices of #113 within the decisions above, confirmed by the
  owner (2026-11-13): each `texts.de.ts` exports one object `texts` typed with
  `EntryText` (not single exports `n`, `ab`, …), so the compiler checks
  every file on its own; the index has its own list `TEXTS` instead of a
  third element in `ENTRIES`; the accessor is its own file `text.ts`,
  because `texts.ts` is not mutated.
* **[E]** Decided for #116 (owner, 2026-11-14): every mission folder holds a
  `texts.de.ts` with its name; the generator lists them as `MISSION_TEXTS`;
  the accessor `missionText(m)` stands next to `text(key)`, so that
  `text('spy')` stays the research. `src/core/texts.ts` is removed, and
  `MISSION` moves from `catalog.ts` to `src/core/missions.ts`.
* **[E]** Built with #116: `src/features/missions/<m>/texts.de.ts` exports
  `texts` typed with `MissionText` (`n`, the name), like the entry texts;
  `missionText(m)` is in `src/core/text.ts`, undefined for a name that is no
  mission. `MISSION` (`src/core/missions.ts`) builds the names in the order
  of the rules; `catalog.ts` re-exports it for the existing imports of the
  tests. Stryker leaves the mission texts out through the existing glob
  `src/features/**/texts.de.ts`.
