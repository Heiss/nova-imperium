---
type: log-entry
date: 2026-11-24T10:30
kind: Code
issues: [369]
---

The keyed lists of the views (#369). An audit judged all 136 `{#each … (key)}` of `src/client`: 62 constant, 33 from one source with a unique key, 33 keyed by the index, 6 merged from several sources with a dedupe, and 2 that could get the same key twice, the cards „Achtung“ and „Bereit“ of the overview on a phone, keyed by their text: two attacks of one player from one place read the same, and so do a planet named „X (Mond)“ and its moon „X“. They are keyed by the fleet, the place or the kind of the line now (`src/client/logic/overview-cards.ts`, two new cases that show the texts collide). The guard `src/client/views/keyed-lists.test.ts` lists every keyed list with the reason its key cannot repeat; a new one fails until it is judged, and a merged list names the unit test of its keys. A server render in Vitest does not throw on a duplicate key, so the guard reads the sources (proposal 2 of the issue, for the merged lists also 3). Changed existing tests: five cases of `src/client/logic/overview-cards.test.ts` that compare whole card lines now expect their key too.
