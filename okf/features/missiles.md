---
type: feature
title: Missiles
description: The missile silo, anti-ballistic missiles and interplanetary missiles against defense with their classic values; missiles are no longer a non-goal (issue #54).
---

# Missiles

Issue #54, part of the Classic features (#222). The owner's answers of
2026-11-16, checked against owiki.de the same day. Sources:

* „Raketensilo“ (https://owiki.de/index.php?title=Raketensilo&oldid=78597)
* „Abfangrakete“ (https://owiki.de/index.php?title=Abfangrakete&oldid=77815)
* „Interplanetarrakete“ (https://owiki.de/index.php?title=Interplanetarrakete&oldid=78711)
* „Changelog vor Redesign“ (https://owiki.de/index.php?title=Changelog_vor_Redesign&oldid=78869)

# Decisions

* **[E]** Missiles come: they are no longer a non-goal (owner, 2026-11-16,
  D1; [Overview](/overview.md)).
* **[E]** Missile silo (owner, 2026-11-16, Q1): 20,000 Adamant, 20,000
  Psikristall, 1,000 Promethium, factor 2; per level room for 5
  interplanetary or 10 anti-ballistic missiles, an interplanetary missile
  takes the room of two (owiki „Raketensilo“).
* **[E]** Anti-ballistic missile (owner, 2026-11-16, D2, checked on owiki
  as asked): 8,000 Adamant, 0 Psikristall, 2,000 Promethium (owiki
  „Abfangrakete“).
* **[E]** Interplanetary missile (owner, 2026-11-16, Q1): 12,500 Adamant,
  2,500 Psikristall, 10,000 Promethium, attack 12,000 (owiki
  „Interplanetarrakete“).
* **[E]** Range: (impulse drive level × 5) − 1 systems (owner, 2026-11-16,
  Q1). owiki dates this formula to v0.78c (17 January 2008).
* **[U]** The smaller range before v0.78c is not documented; it is not
  needed, as the owner took the formula above.
* **[E]** Flight time in seconds: (30 + 60 × systems) / universe speed
  (owner, 2026-11-16, Q1; owiki „Interplanetarrakete“).
* **[E]** Defense destroyed by missiles is not rebuilt (owner, 2026-11-16,
  Q1; owiki „Interplanetarrakete“).
* **[E]** The anti-ballistic missiles of a planet also protect its moon
  (owner, 2026-11-16, Q1; owiki „Raketensilo“, moons can be attacked by
  missiles since v0.78a).
* **[E]** Damage of interplanetary missiles: the main target first, then
  the order of the catalog (owner, 2026-11-16, D3).

# Proposals

The classic values on owiki that the owner's list did not name:

* **[V]** Silo requirement shipyard 1. Anti-ballistic missile: structure
  8,000, shield 1, attack 1; needs silo 2 and shipyard 1. Interplanetary
  missile: structure 15,000, shield 1; needs silo 4, shipyard 1 and impulse
  drive 1 (owiki).
* **[V]** One anti-ballistic missile stops exactly one interplanetary
  missile; missiles take no fleet slot and cannot be recalled; they
  cannot target a player in noob protection or in vacation mode; there is
  no silo on a moon (owiki).
* **[V]** Debris of defense destroyed by missiles does not go into the
  Trümmerfeld (owiki „Interplanetarrakete“, see
  [Trümmerfelder](/features/debris.md)).
* **[V]** Names from [Grimdark naming](/features/naming.md): Raketenkrypta
  (silo), Abfangrakete, Orbitalrakete.
