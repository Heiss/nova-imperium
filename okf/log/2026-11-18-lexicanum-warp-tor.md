---
type: log-entry
date: 2026-11-18T15:35
kind: Decision and code
issues: [285, 230, 293]
---

#285, the article of the Warp-Tor (#230, added by #293 while the Lexicanum was in review): every catalog entry has an article, and a pull request that adds an entry updates its article. The new `src/features/jumpgate/lexicon.de.ts` holds the words before the formula, drafted by Claude as [V] in the style of the Mondzitadelle and the Auspex-Phalanx, and five everyday keywords (Tor, springen, Teleport, Flotte, Mond); every number in the text is a value of `src/core/jump-gate.ts`. It says how the cooldown falls with the level of the starting gate, that both gates wait as long as the starting gate says, that the minutes are divided by the universe speed, that the jump is at once and without fuel and that the resources stay. The formula and the table of the cooldown in this universe (levels 1 to 5, 10 and 15, the decided values) are computed from `gateCooldown` and `gateCooldownMs` and checked by the guards against the rule. The review list [Lexicanum texts](/features/lexicanum-texts.md) holds the draft (see [Lexicanum](/features/lexicanum.md), [Moons](/features/moons.md)).
