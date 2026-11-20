---
type: Policy
title: 'Display texts are not mutation-tested'
description: 'Why the display texts are left out of the mutation tests and how they are tested instead.'
---

# Display texts are not mutation-tested

* **[E]** Display texts are not mutation-tested (owner, 2026-11-12, #131):
  the names, abbreviations, short and long texts of the catalog and the
  mission names live in `src/core/texts.ts`, which Stryker leaves out
  (`stryker.config.json`); it has no floor in `mutation-floors.txt`.
  Since #113 the texts of each catalog entry live in
  `src/features/<key>/texts.de.ts`, which Stryker leaves out the same way
  (owner, 2026-11-13); `src/core/texts.ts` keeps the mission names, and the
  accessor `text(key)` (`src/core/text.ts`) is mutated.
  Each text was a static mutant that reloaded every test, most of the time
  of a run. Their exactness is guarded by the catalog, naming and
  explanation tests (`catalog.test.ts`, `src/test/naming.test.ts`,
  `explain.test.ts`) and `src/core/text.test.ts` (#113: every catalog entry
  has a name, an abbreviation and a short text, abbreviations are unique,
  no text without an entry); `src/test/mutation-shards.test.ts` checks that
  no text file is mutated. Game values stay mutated in
  `catalog.ts`, and since #114 in the `src/features/<key>/entry.ts` of
  each entry. See [Design patterns](/architecture/patterns.md).
  Since #116 the mission names live in
  `src/features/missions/<m>/texts.de.ts`, left out by the same glob, and
  `src/core/texts.ts` is gone (owner, 2026-11-14); its line in
  `stryker.config.json` stays, so the file stays out if it ever comes back.
  `src/core/missions.test.ts` requires one name per mission and no text
  file without a mission; the accessor `missionText(m)` in
  `src/core/text.ts` is mutated.
