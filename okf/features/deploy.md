---
type: feature
title: Deploy mission „Verlegung“
description: Moving ships and cargo to another own planet for good (classic „Stationieren“), with half the used fuel unloaded at the target (issue #129).
---

# Deploy mission „Verlegung“

Issue #129, milestone `next release` (owner, 2026-11-12). Classic rules from
owiki.de („Stationieren“, read 2026-11-12). Before it, ships could only fly
attack, transport, spy and colonize; a transport to an own planet unloads and
the ships fly back.

* **[E]** In this release, built at once in parallel to #94 and #126
  (owner, 2026-11-12).
* **[E]** Target: an own planet other than the start planet (owner,
  2026-11-12).
* **[E]** Ships and cargo stay at the target; the cargo is unloaded like a
  transport, also above the storage limit (owner, 2026-11-12).
* **[E]** Fuel: the rounded-down half of the fuel the flight used is unloaded
  at the target too (classic since v0.68a; owner, 2026-11-12).
* **[E]** A recall during the flight brings ships and cargo back to the
  start planet (owner, 2026-11-12).
* **[E]** Display name „Verlegung“ in the grimdark style of #94 (owner,
  2026-11-12); key `deploy`.
* **[U]** owiki.de also lists moons and the sensor phalanx; both do not exist
  in the game yet (moons #53).

# Code, interface and tests

* Mission `deploy` in `MISSION` (`src/shared/catalog.ts`, „Verlegung“) and
  `Mission` (`src/shared/types.ts`); the fleet form, the overview and the
  fleet list take it from `MISSION`.
* Send (`src/server/game/fleet-actions.ts`): `checkTarget()` lets a deploy
  fly only to an own planet; the start planet, an empty position, cargo,
  fuel and fleet slots are checked like for every mission, noob protection
  does not apply. The flight takes a fleet slot until it arrives.
* Fuel: `Fleet.fuel` holds the fuel burnt at the start (`fuelFor()`), for
  every mission. **[V]** Stored in the new column `fleets.fuel` (migration
  12, which rebuilds `fleets` and `fleet_ships` for the new mission in the
  CHECK; fleets in flight keep everything and get 0, see
  [SQLite storage](/data/sqlite.md)).
* Arrival (`src/server/game/arrival.ts`): `deploy()` puts the ships and the
  cargo plus ⌊fuel / 2⌋ deuterium on the target with `land()` (also above the
  storage limit, as a transport) and deletes the fleet; there is no return
  flight. `fits()`: when the target is gone or no longer the player's, the
  fleet turns back with its cargo and the report „Flotte kehrt um“, like a
  transport to a vanished planet.
* Recall: unchanged; ships and cargo come back to the start planet with the
  usual return report, the burnt fuel is not refunded (no recall refunds
  fuel).
* **[V]** Refusal „Verlegung nur zu einem eigenen Planeten.“; the start
  planet keeps „Das ist dein eigener Planet.“ and an empty position „An
  dieser Position gibt es keinen Planeten.“
* **[V]** Report for the owner, in the style of the transport report: title
  „Verlegung erreicht [g:s:p]“, text „Deine Flotte bleibt auf ‹Planet›
  [g:s:p] und liefert ‹Ladung›, davon N übriger Treibstoff.“; push as a
  message, like the transport report.
* **[V]** Galaxy: a button „Verlegung“ next to „Wechseln · Transport“ for
  another own planet; it opens the fleet form with the target and the
  mission. On a phone the player and action cells of the galaxy wrap, so the
  table no longer widens the page (it did with two own planets before).
* **[V]** The fleet form shows „‹Ankunft› / –“ for a deploy, as there is no
  return; the fleet list has no own colour for a deploy (like colonization).
* Tests: `src/server/game/fleet.test.ts` (target rules, cargo and fuel,
  slot until arrival, ships and cargo plus half the fuel at the target via
  the action, recall), `arrival.test.ts` (above the storage limit, odd fuel
  rounded down, target lost or foreign), `src/server/db/store.test.ts`,
  `upgrades/migration-12.test.ts` (fleets in flight survive, `deploy`
  accepted), `upgrades/migration-9.test.ts` (writes the fleet with the
  columns of version 8); E2E „a Verlegung moves part of a fleet with its
  cargo to an own colony for good (#129)“ and the phone variant from the
  galaxy in `e2e/game.spec.ts` (`e2e/seed.ts` option `landFleet`).
