---
type: log-entry
date: 2026-11-13
kind: Code
issues: [113]
---

#113 built: the display texts of every catalog entry in `src/features/<key>/texts.de.ts`, listed as `TEXTS` in the generated index; `text(key)` (`src/core/text.ts`) for server and browser instead of `def.n`, `ab`, `ds`, `lt`; the rules hold no text; the mission names stay in `src/core/texts.ts`; the 12 classic ships and defenses get the owner's short texts, and a test requires name, abbreviation and short text for every entry; the text files are not mutated (see [Design patterns](/architecture/patterns.md), [Grimdark naming](/features/naming.md), [Test strategy](/ops/testing.md)).
