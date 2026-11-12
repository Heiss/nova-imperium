---
type: feature
title: Fusionskraftwerk
description: The deuterium-burning power plant of issue #47, its values, the throttling at an empty deuterium stock and the universe speed.
---

# Fusionskraftwerk

Issue #47, milestone `next release` with #46, #49 and #50 (owner, 2026-11-12).
Not in version 1; the classic values of the issue, confirmed by the owner as
they are (2026-11-12).

* **[E]** Costs 900 metal, 360 crystal, 180 deuterium at level 1, factor 1.8
  per level. Requires Deuteriumsynthetisierer 5 and Energietechnik 3 (owner,
  2026-11-12).
* **[E]** Energy E = 30 · F · (1.05 + 0.01 · T)^F, F = level, T =
  Energietechnik level; deuterium use 10 · F · 1.1^F per hour. Its own share
  0–100 % on the resources page (`PRODUCERS`) applies to energy and use
  alike (owner, 2026-11-12).
* **[E]** The use is multiplied by the universe speed like the production
  (D2 = 1, owner, 2026-11-12).
* **[E]** Empty stock (D1 = 1): when the deuterium stock is 0 and the use is
  higher than the production, the reactor runs at the share where use equals
  production, so the stock never goes below 0. The result must not depend on
  when the planet is settled (owner, 2026-11-12).
* **[U]** The values are from the owner's comparison and the wiki (sources
  in #47); the owner took them over unchanged.
* **[V]** The throttled share is a fixed point: the reactor's energy changes
  the mine factor `f`, which changes the deuterium production
  (`prod()`, `src/shared/economy.ts`). It is found numerically (for example
  by bisection) and tested for monotonicity. `accrue` gets a breakpoint at
  the moment the stock reaches 0; `src/shared/settle.ts` stays exact and the
  equivalence tests of version 1 stay unchanged.
* **[V]** German interface: Gebäude „Fusionskraftwerk“ with new art, energy
  and deuterium use per level; Rohstoffe a line with energy (+), deuterium
  (−) and its share.
