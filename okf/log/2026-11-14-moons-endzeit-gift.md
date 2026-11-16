---
type: log-entry
date: 2026-11-14
kind: Code
issues: [53]
---

#53, second pull request, first part (owner, 2026-11-14, „Geklärt, Nachtrag 2“): the Endzeit gift raises only the buildings that may stand at its target, checked with `placement` (`standing()` in `src/core/endzeit.ts`), so the Mondzitadelle and other moon-only buildings are skipped on the home planet and research is raised as before, with a test that failed before; the decided rules of the Auspex-Phalanx in `src/core/phalanx.ts` (range level² − 1, the scan price of 5,000 Promethium, moons, Trümmerfelder and own planets refused, the flights to and from a planet without cargo), not yet used; the building, its key, the range over galaxies and systems, the scan of an empty target and the interface are open for the owner (see [Moons](/features/moons.md), [Endzeit](/features/endzeit.md)).
