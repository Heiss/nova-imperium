---
type: Architecture
title: '12. Tests per component'
description: 'Which tests each component of the patterns brings: contract tests, equivalence tests and the reference tests of the views.'
---

# 12. Tests per component

* **[E]** Every component has contract tests that run for every entry that
  has it (for example: `produces` is finite and ≥ 0, `combat` has a hull
  > 0). A new entry is checked without new test code; its own tests cover
  only what is its own.
* **[E]** Built with #114 for the production group: the contract tests are
  `src/core/components/<component>.test.ts`; they read every entry with the
  component from the generated index (rates finite and ≥ 0 for levels 0 to
  60 on generated planets, nothing at level 0, one production order and one
  store per resource each, costs whole and never falling for levels 1 to
  60). `src/core/production.test.ts` compares `prod()` bit for bit with the
  `prod()` from before #114 on generated planets, with Fusionskraftwerk and
  Solarsatelliten.
* **[E]** Built with #114 for the combat group:
  `src/core/components/unit.test.ts` (on every ship and defense only, the
  cost of a piece three whole numbers ≥ 0, not all 0) and
  `src/core/components/combat.test.ts` (with every `unit`; hull, shield and
  attack finite and above 0; rapid fire whole and above 1 against an entry
  that fights; only ships are easy). `src/core/battle-reference.test.ts`
  compares `buildSide()`, `rapid()` for every pair and `battle()` with the
  same random stream, draw for draw, bit for bit with `battle.ts` from
  before the combat components on generated sides.
* **[E]** Built with #114 for the flight group:
  `src/core/components/mobile.test.ts` (only on ships; speed above 0, cargo
  whole and ≥ 0, fuel whole and above 0, a known drive; drive switches to a
  known drive from a research level above 0; the speed finite and at least
  the base speed of the active drive for research levels 0 to 30).
  `src/core/flight-reference.test.ts` compares `activeDrive()`,
  `shipSpeed()`, `fleetSpeed()`, `fuelFor()`, `capacity()` and `canFly()`
  bit for bit with their form before the flight component, for every key
  of the catalog and an unknown one, on generated fleets and research
  levels.
* **[E]** Built with #114 for the limits group:
  `src/core/components/limit.test.ts` (only on defense; `perPlanet` whole
  and ≥ 1; the room whole, between 0 and the limit, all of it on an empty
  planet) and `src/core/components/energy-threshold.test.ts` (only on
  buildings and research; base > 0, f ≥ 1; the need finite and never
  falling for levels 1 to 60). `src/core/limits-reference.test.ts` compares
  `unitRoom()`, `orderMax()` (its value or its error), `energyNeed()` and
  `energyShort()` bit for bit with their form before the limits group, for
  every key of the catalog, an unknown one and inherited names
  (`constructor`, `toString`, `__proto__`, `hasOwnProperty`), on generated
  planets, queues and levels.
* **[E]** Built with #114 (ProducerTable): `src/core/producer-rows.test.ts`
  checks on generated planets, with the throttled Fusionskraftwerk, that
  the rows of `producerRows()` add up to `prod()` of the planet as it runs:
  `f`, the energy made and used bit for bit, Adamant, Psikristall and
  Promethium bit for bit at universe speed 1 and to 6 decimals otherwise
  (`prod()` multiplies the sum with the speed, a row each rate).
  `src/test/catalog-keys.test.ts` scans `src` without `src/features/`, the
  tests and `src/test/legacy` with the TypeScript and Svelte parsers for
  comparisons with a key (the folder names under `src/features/`, without
  `missions/`): `===`, `!==`, `==`, `!=`, `case` and `includes` on an array
  literal or a const bound to one. Its allow-list `ALLOWED` names file,
  key, count and issue; the count is the number of hits of that key in that
  file, and the test fails when the real number is higher (a new
  comparison) and when it is lower (the count must be lowered), so the
  counts only fall and an entry goes when it reaches 0 (owner,
  2026-11-14). The entries `core/lab.ts` `lab` 2 and
  `client/logic/catalog-list.ts` `yard` 1, the lab and shipyard locks
  (#183, „Lab lock and shipyard lock without catalog keys“), went with the
  component `locks`. The generic events of
  #115 removed the comparisons in `core/settle.ts` (`sat` 1 and `energy` 1)
  and `server/game/actions.ts` (`energy` 1 and `fusion` 1). The mission registry of #116 removed the comparisons in
  `server/game/fleet-actions.ts` and `server/game/arrival.ts` (`probe` 1,
  `spy` 4). The report type `spy` in `client/views/messages.ts` (1) equals
  a catalog key without being one and stays allowed for good, as
  `permanent` instead of an issue (owner, 2026-11-14). The state
  of a building or research that lacks energy is `noEnergy` (not `energy`),
  so the scan does not hit it (owner, 2026-11-14).
* **[E]** Built with #115 for the generic events:
  `src/core/settle-reference.test.ts` compares `settle()` in one step and
  in steps, `accrue()`, `production()`, the throttled share and the
  planets the server settles with a frozen copy of `settle.ts`, of the
  throttle and `accrue()` of `economy.ts` and of the predicate of
  `settleReactors()` from before #115, on 300 generated planets, queues,
  research levels and universe speeds (fast-check seed 115), bit for bit,
  and checks that the cases meet every event. On the same cases settling
  in steps equals one step within the tolerance of #47, and a stock never
  goes below 0 nor grows above its storage limit.
  `src/server/game/research-reference.test.ts` starts a research on two
  equal databases, with today's action and with a frozen copy of the
  action before #115, and compares the answer and every table (300 cases,
  seed 115, every case closes its databases). `src/core/settle.test.ts`
  tests each event; the contract test of `consumes` allows one entry that
  uses a stock.
* **[E]** Built with #116 for the missions: `src/core/missions.test.ts`
  checks the rules of every mission in the index (exactly the typed
  fields, a known target kind, the order in steps of 10 and once each,
  `canSend` gives a known code or nothing on generated fleets, one name
  each) and the generic target check; `src/server/game/missions.test.ts`
  checks for every mission that it has an arrival in `MISSION_SERVERS`,
  turns back from a target that does not fit its kind, flies back only if
  it returns, comes home silently only if silent, shows its ships only if
  visible (since #228: only by the Auspex-Lehre, for every mission) and
  takes cargo only if it carries cargo.
  `src/server/game/missions-reference.test.ts` compares sending, the
  arrival and the coming home with the code from before #116 on generated
  worlds and fleets: the answer or message, every table and the next random
  number.
