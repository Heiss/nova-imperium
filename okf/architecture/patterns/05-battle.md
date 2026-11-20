---
type: Architecture
title: '5. Battle: pure function, consequences as a fixed pipeline'
description: 'The battle as a pure function and its consequences (debris, moon chance, loot) as a fixed pipeline.'
---

# 5. Battle: pure function, consequences as a fixed pipeline

* **[E]** `battle()` takes any number of parties and returns the losses per
  party. The consequences run as a fixed pipeline of pure steps: debris,
  moon chance, rebuilding defense, reports.
* **[E]** No event bus: the order must stay deterministic with the seeded
  `rng`.
* **[E]** Built with #55: `battleOf(attackers, defenders, rng)` in
  `src/core/battle.ts` takes any number of parties per side; every unit
  shoots at a random unit of the other side, whatever its party, and the
  survivors come back per party. `battle()` is `battleOf` with one party
  on each side and draws bit for bit as before (the reference test of
  #114 and a test per seed). The Sturmangriff fights the owner of the
  planet and every fleet that holds there; the debris step takes every
  party, each owner of a held fleet gets the defender's report.
* **[E]** Built with #53: the moon step follows the debris step and comes
  before the rebuilt defense: at a planet without a moon the chance of the
  whole field is rolled once when it is above 0, and a hit draws the
  diameter (`src/core/moon.ts`, `rollMoon` in `src/server/game/moons.ts`).
