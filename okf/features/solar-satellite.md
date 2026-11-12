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
* **[V]** Internal key `sat`.
* **[E]** Its cost counts to the points; it takes no fleet slot (D3 = 1,
  owner, 2026-11-12).
* **[U]** The values are from the owner's comparison and the wiki (sources
  in #46); the owner took them over unchanged.
* **[V]** The engine gives the default rapid fire 5 only against the probe
  (`rapid()`, `src/shared/battle.ts`); it gets a second default for the
  satellite. Debris only once #45 exists.
* **[V]** German interface: Werft „Solarsatellit“ with new art and the energy
  per satellite on the active planet; Rohstoffe a line „Solarsatelliten (n)“
  with energy and share; Flotte doesn't offer it.
