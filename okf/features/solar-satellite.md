---
type: feature
title: Solarsatellit
description: The energy satellite of issue #46, its values, energy formula, production share, battle role and points.
---

# Solarsatellit

Issue #46, milestone `next release` with #47, #49 and #50 (owner, 2026-11-12).
Not in version 1; the classic values of the issue, confirmed by the owner as
they are (2026-11-12).

* **[E]** „More ships“ is no longer a non-goal ([Overview](/overview.md),
  owner, 2026-11-12).
* **[E]** Costs 0 metal, 2,000 crystal, 500 deuterium. Attack 1, shield 1,
  structure 2,000 (hull 200 in the engine, (M + K) / 10). Cargo, speed and
  fuel 0: it can't be sent in any fleet; the server refuses it. Requires
  Werft 1 (owner, 2026-11-12).
* **[E]** Energy per satellite ⌊temp / 4 + 20⌋, rounded down per satellite
  (D2 = 1); `temp` is the planet's maximum temperature. This is the classic
  formula of the old design up to version 0.84 on owiki.de; ⌊(temp + 140) / 6⌋
  is the one from version 1.0 on (owner, 2026-11-12, replaces the first
  decision of the same day). The planet gets n · ⌊temp / 4 + 20⌋ times the
  share.
* **[V]** A satellite never yields negative energy (at least 0); with the
  temperatures of `createPlanet` the formula stays above 0 anyway.
* **[E]** Own production share 0–100 % on the resources page, like the
  Solarkraftwerk (`PRODUCERS`) (D1 = 1, owner, 2026-11-12).
* **[E]** It fights as a defender, can be destroyed, and every ship except
  the Spionagesonde and the satellite itself has rapid fire 5 against it
  (owner, 2026-11-12; owiki.de lists no rapid fire of the probe).
* **[E]** Its cost counts to the points; it takes no fleet slot (D3 = 1,
  owner, 2026-11-12).
* **[U]** The values are from the owner's comparison and the wiki (sources
  in #46); the owner took them over unchanged.
* The code: key `sat`, abbreviation `SA` in `SHIPS` (`src/core/catalog.ts`),
  speed 0. `canFly()` keeps it out of the fleet view and the server refuses
  it („Solarsatelliten können nicht fliegen.“, `fleet-actions.ts`).
  `satEnergy()` and `satPower()` in `src/core/economy.ts` add its energy to
  `prod()`; without satellites the result is the one of version 1. `PRODUCERS`
  has `sat`, so its share is set like the Solarkraftwerk's. `rapid()` gives
  every ship but the probe and the satellite 5 against probe and satellite.
  `settle()` (`src/core/settle.ts`) splits production when the shipyard
  finishes a satellite, so its energy counts from that moment; without
  satellites in the queue the split is the one of version 1. Debris only once
  #45 exists.
* The interface: Werft „Solarsatellit“ with the icon of the interface v2 set
  and „Energie n je Satellit“ for the active planet, no cargo and speed;
  Rohstoffe a line „Solarsatelliten (n)“ with energy and share; Flotte does
  not offer it.
* Tests: `catalog.test.ts`, `economy.test.ts`, `battle.test.ts`,
  `src/server/game/fleet.test.ts`, `arrival.test.ts`, `actions.test.ts`, E2E
  „Solarsatelliten give energy by temperature and never fly (#46)“; the E2E
  seed takes `temp`.
