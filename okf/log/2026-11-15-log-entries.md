---
type: log-entry
date: 2026-11-15T01:52
kind: Code
issues: [212, 210]
---

#212 built with the owner's decisions of 2026-11-15 (issue and comment „Geklärt“, O15): the update log is one file per entry, `okf/log/<date>-<short-name>.md` (D1); the 136 entries of `okf/log.md` are split into 136 files, every date, kind and text unchanged, and the two entries #210 added meanwhile became files at the merge of `main` (D2); the website builds the log page from the folder at the URL it had, `/decisions/log/`, and `okf/log.md` is removed (D3); the front matter `type: log-entry`, `date`, `kind` and `issues` as built, `issues` with every `#N` the text names; new entries carry a UTC time in `date` (`2026-11-15T00:30`) and a day lists its entries newest first, the entries before keep the date only and follow by file name; the time is required from 2026-11-15 on [V]; `scripts/okf-log.ts` checks every entry in `pnpm check` (`src/test/okf-log.test.ts`) and in the CI job „Documentation website“, and the website reads the entries through it; label `kein-changelog` (see [Documentation website](/ops/website.md), [Release loop](/ops/loop.md), [Open points](/open-points.md)).
