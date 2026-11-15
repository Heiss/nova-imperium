---
type: log-entry
date: 2026-11-15
kind: Code
issues: [212]
---

#212 built with the owner's decisions of 2026-11-15 (issue and comment „Geklärt“): the update log is one file per entry, `okf/log/<date>-<short-name>.md` (D1); the 136 entries of `okf/log.md` are split into 136 files, every date, kind and text unchanged (D2); the website builds the log page from the folder at the URL it had, `/decisions/log/`, and `okf/log.md` is removed (D3); the front matter `type: log-entry`, `date`, `kind` and `issues`, and the order by file name within a date, are proposals [V] (O15); `scripts/okf-log.ts` checks every entry in `pnpm check` (`src/test/okf-log.test.ts`) and in the CI job „Documentation website“, and the website reads the entries through it; label `kein-changelog` (see [Documentation website](/ops/website.md), [Release loop](/ops/loop.md), [Open points](/open-points.md)).
