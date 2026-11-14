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
  (`prod()`, `src/core/economy.ts`). It is found numerically (for example
  by bisection) and tested for monotonicity. `accrue` gets a breakpoint at
  the moment the stock reaches 0; `src/core/settle.ts` stays exact and the
  equivalence tests of version 1 stay unchanged.
* **[V]** German interface: Gebäude „Fusionskraftwerk“ with new art, energy
  and deuterium use per level; Rohstoffe a line with energy (+), deuterium
  (−) and its share.

## Code

* **[V]** Key `fusion` in `BUILD` (`src/core/catalog.ts`), after the
  Solarkraftwerk; abbreviation `Fu` (no other entry uses it); short text
  „Erzeugt Energie aus Deuterium; Energietechnik steigert die Leistung.“
  `PRODUCERS` has `fusion`, so the server accepts its share like the others.
* **[V]** Energietechnik reaches the production as a third, optional
  parameter: `prod(p, u, research)` takes the owner's research levels
  (`Levels`, default `{}`); `fusionEnergy(F, T)` and `fusionUse(F, u)` are the
  two formulas. The reactor adds `fusionEnergy · share` to `eProd` and takes
  `fusionUse · share` from `d`, which can now be negative. Without a reactor
  both terms are 0 and the result is the one of version 1 to the last digit;
  the equivalence test also passes the research now.
* **[V]** Throttling (D1): `fusionThrottle(p, u, research)` is null unless the
  stock is 0 and `prod().d < 0`; then `balancedShare()` bisects the share in
  [0, set share] until the interval is one floating point step wide (no
  tolerance constant) and returns the side where the net deuterium is ≥ 0.
  The net production is concave in the share (the mine grows with
  `f = min(1, …)`, the use is linear), so there is exactly one crossing.
  `production()` is the production as it runs: at the throttled share, with
  `d` exactly 0. The resources page, the resource bar and the energy check of
  Gravitonforschung use it.
* **[V]** Breakpoints: `accrue()` computes when a falling stock reaches 0,
  adds the production up to then, sets the stock to exactly 0 and adds the
  rest with `production()`. A use always lowers the stock, also above the
  storage limit (growth still stops at the limit). `settle(p, until, u, r)`
  takes the owner's `ResearchState` as stored and splits where a running
  Energietechnik finishes, only for a planet with a reactor; the research
  levels of each segment come from `settleR`. Without a reactor and without
  satellites the split is the one of version 1.
* **[V]** Callers that store the planet pass the owner's research: `mine()`
  of the actions, the admin's speed change, the arrival at a target and the
  return home; the browser passes its own research. Callers that only read
  levels or queues (labs, points, achievements, push) do not.
* **[V]** The stored research forgets when Energietechnik finished as soon as
  the next research starts. Before that, `settleResearchEnd()`
  (`src/server/game/actions.ts`, named `settleReactors()` before #115)
  settles and stores every own planet with a reactor (or one being built),
  so a planet settled later still uses the old level up to that end. Since
  #115 these are the planets whose production the finished research
  changes (`feelsResearch()`), which are the same.

## Interface (German)

* **[V]** Gebäude: „Fusionskraftwerk“ with the icon
  `icons/buildings/fusion_reactor.svg` of the interface v2 set, its costs,
  requirements, the energy change of the next level (with Energietechnik)
  and „Deuteriumverbrauch auf Stufe n: x pro Stunde“ at the set share.
* **[V]** Rohstoffe: a line „Fusionskraftwerk (Stufe n)“ with deuterium (−),
  energy (+) and its share select; the Deuteriumsynthetisierer line shows the
  mine alone. When throttled: „gedrosselt auf x %“ (rounded down) next to the
  select, which keeps the set share; the sum shows the running production.

## Tests

* `src/core/fusion.test.ts`: formulas with Energietechnik and speed, share,
  solar + satellites + fusion together, the throttled share (use =
  production, the closed form below the kink of `f`, one crossing,
  monotone in the mine and the reactor), the breakpoint in `accrue`, and a
  fast-check property: settling in one step or in many gives the same stock
  (1e-6 + 1e-9 relative) and the stock is never below 0, with a running
  Energietechnik and a reactor being built.
* `catalog.test.ts`, `research.test.ts` (Gravitonforschung counts the
  reactor), `equivalence.test.ts` (research passed, version 1 unchanged),
  `src/server/game/actions.test.ts`, `admin.test.ts`, `arrival.test.ts`.
* E2E „the Fusionskraftwerk burns deuterium for energy and is throttled at
  an empty stock (#47)“; the E2E seed takes `pct`.
