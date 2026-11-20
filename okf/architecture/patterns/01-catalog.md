---
type: Architecture
title: '1. Catalog: typed composition'
description: 'Catalog entries as typed data with components (produces, consumes, storage, limits, flight, combat) instead of special cases in a shared file.'
---

# 1. Catalog: typed composition

* **[E]** A catalog entry is a key plus optional, typed components:
  `leveled`, `unit`, `produces`, `consumes`, `storage`, `energyThreshold`,
  `fields`, `limit`, `placement`, `combat`, `mobile`.
* **[E]** Each component has exactly one rule module in `src/core`; only
  that module reads the component. No other code asks for a key.
* **[E]** Behaviour that differs per entry is a typed function field of a
  component, for example the rate formula of `produces`, or data that the
  rule module evaluates, for example the drive switches of `mobile` (owner,
  2026-11-14, replaces the example `drive: (research) => DriveKey`). There
  are no free hooks (`onBuild`, `onSettle`): they bring the scattered
  special cases back.
* **[E]** A component is created when at least two entries need it, or an
  issue requires the rule to be generic. Until then the special rule stays
  in the folder of its entry.
* **[V]** No ECS framework and no runtime registry of systems: components
  are plain fields, the rule modules are plain functions.
* **[E]** Decided for the first pull request of #114 (owner, 2026-11-13):
  all 49 entries get `src/features/<key>/entry.ts`; only `produces`,
  `consumes`, `storage` and `leveled` become components, every other field
  moves unchanged and becomes a component in its group's pull request. Each
  `entry.ts` exports its `kind` (building, research, ship, defense) and a
  numeric `order`; `catalog.ts` builds `BUILD`, `RES`, `SHIPS`, `DEF` and
  `UNIT` from the generated index by kind and order, today's order stays and
  the core holds no key list. `produces` and `consumes` are one rate
  function per resource plus a production order; the base income (20
  Adamant, 10 Kristall) is a core constant; `prod()` stays bit-identical,
  proven by a property test against the old `prod()`. `leveled` is
  `{ cost, f? }` with the default 2 in `lvlCost`; `storage` is
  `{ res: 'm' | 'c' | 'd' }` with the capacity formula in the core. One file
  per component under `src/core/components/`, its contract test next to it.
* **[E]** Built with #114 (production group): `entry.ts` exports `kind`,
  `order`, its components (`leveled`, `produces`, `consumes`, `storage`)
  and the remaining fields as `def`; `catalog.ts` added the texts of the key
  from `src/core/texts.ts` until #113 moved them into the entry folders. `src/core/components/`
  holds `leveled.ts` (`lvlCost`, `sumLevels`), `storage.ts` (`capOf`,
  `capacities`), `produces.ts` (`BASE_INCOME`, `energyMade`, `made`: base
  income plus the rates times the universe speed, never below 0) and
  `consumes.ts` (`energyUsed`, `left`); `economy.ts` keeps its exports and
  composes them in `prod()` and `caps()`. `PRODUCTION`, `STORAGE` and
  `PRODUCERS` are derived from the components; `PRODUCERS` stays deeply
  equal (it was [V] in #114). The level of a ship in a rate is its number on
  the planet (Solarsatellit).
* **[E]** Choices of #114 within the decisions above, confirmed by the
  owner (2026-11-14): the `order` values step by 10 (room for new entries
  without renumbering); the production order is the field `order` of
  `produces`, and an entry that consumes also produces (contract test); the
  formulas the rates share (`growth`, `grows`, Solarsatellit and
  Fusionskraftwerk) are in `src/core/rates.ts`, the shared formula module
  of the entries; the throttle of the Fusionskraftwerk (`balancedShare`)
  still names its key and becomes generic with the events of #115.
* **[E]** Decided for the second pull request of #114, the combat group
  (owner, 2026-11-13): `unit` is `{ cost }`, the cost of one piece, the
  counterpart of `leveled`; `req` stays in `def`, „once per planet“ waits
  for `limit` and the flight fields wait for `mobile`. `combat` is
  `{ atk, sh, rf? }` with today's names; the hull is not stored but derived
  from `unit.cost` ((Adamant + Psikristall) / 10) in the rule module
  `src/core/components/combat.ts`, and the contract test checks that it is
  above 0. The default rapid fire against easy targets is the flag
  `easy: true` in `combat` of the Spähschädel and the Sonnenreliquiar plus a
  core constant 5 instead of the key list in `battle.ts`: every ship that is
  not easy itself and names no rapid fire against the target gets 5, defense
  gets none (replaces the [V] „a field of `combat` instead of a key list“ of
  #114). Only `battle.ts` reads the new components, through the rule
  module; the shipyard, points, the server unit check and the battle
  reports keep reading the `UNIT`, `SHIPS` and `DEF` tables until #118, as
  the first pull request left the resources page. The test that scans `src`
  for catalog keys comes with the last pull request of #114 (`ProducerTable`).
  The exports stay deeply equal and battles bit-identical, proven by a
  property test against the old `battle()`.
* **[E]** Built with #114 (combat group): the ship and defense entries
  export `unit` and `combat`, and `def` keeps their other fields
  (`ShipFields`, `DefenseFields`). `src/core/components/unit.ts` holds the
  type `Unit`; `src/core/components/combat.ts` holds `Combat`,
  `EASY_RAPID_FIRE`, `strength` (hull, shield and attack of one piece before
  the research bonus) and `rapidFire`. `catalog.ts` derives `FIGHTERS`
  (every entry with `unit` and `combat`, by key, with its kind) and builds
  `SHIPS`, `DEF` and `UNIT` from `unit`, `combat` without `easy` and `def`,
  deeply equal to before; `battle.ts` reads `FIGHTERS` through `strength`
  and `rapidFire` and keeps its exports.
* **[E]** Decided for the third pull request of #114, the flight group
  (owner, 2026-11-14): `mobile` is `{ cargo, speed, fuel, drive, drives? }`
  with today's names as data, like `combat`; the drive switch stays a list
  `[{ drive, speed, from: { research, level } }]` that the rule module
  evaluates. The Sonnenreliquiar has no `mobile`: „can fly“ is „has
  `mobile`“, and its flight values come from a core constant `STATIONARY`
  instead of `def`; the contract test checks speed > 0 for every entry with
  `mobile`. Only `flight.ts` reads `mobile`, through the rule module, and
  `canFly` is derived from it; the shipyard, the fleet view and the server
  keep reading `SHIPS` until #118. `DRIVE_BONUS` and `DriveKey` move to
  `src/core/components/mobile.ts`; `catalog.ts` exports them unchanged.
* **[E]** Built with #114 (flight group): every ship that flies exports
  `mobile`, and `def` keeps `req` (`ShipFields`).
  `src/core/components/mobile.ts` holds `Mobile`, `DriveSwitch`,
  `DriveKey`, `DRIVE_BONUS`, `STATIONARY` (`{ cargo: 0, speed: 0, fuel: 0,
  drive: 'comb' }`, the values of version 1), `activeDrive` and `speed`.
  `catalog.ts` derives `MOBILE` (the ships with `mobile`, by key) and
  `canFly` (an own key of `MOBILE`), and builds `SHIPS` from `mobile` or
  `STATIONARY`, deeply equal to before; `flight.ts` reads `MOBILE` through
  the rule module and keeps its exports.
* **[E]** Decided for the fourth pull request of #114, the limits group
  (owner, 2026-11-14): `limit` is `{ perPlanet: number }`, at most that many
  per planet, the stock plus the shipyard queue; the rule is
  `perPlanet − have − queued`, never below 0, and Infinity without a limit;
  both shield domes carry `perPlanet: 1`. `energyThreshold` is
  `{ base, f }` with today's data (Gravitonforschung, Weltenschmiede); the
  formula `base × f^(level−1)` stays in the rule module, and the contract
  test checks base > 0, f ≥ 1 and a need that is finite and never falls for
  levels 1 to 60. `energyNeed` and `energyShort` move to
  `src/core/components/energy-threshold.ts`, and `research.ts` exports them
  unchanged; the limit rule lives in `src/core/components/limit.ts`, and
  `unitRoom` in `yard.ts` calls it. Only the core reads the components
  (`unitRoom`, the energy check through the rule module); the client
  shipyard („max. 1“), the resources page and `Buildings.svelte` keep
  reading `DEF`, `BUILD` and `energyNeed` until #118 (since #118 the list
  of `src/client/logic/catalog-list.ts` reads them). `DEF` keeps
  `once: true` and the tables keep the field `energy` until #118; the
  exports stay deeply equal.
* **[E]** Built with #114 (limits group): the two shield domes export
  `limit`, the Gravitonforschung and the Weltenschmiede `energyThreshold`;
  `def` no longer holds `once` and `energy` (`DefenseFields`,
  `BuildingFields`, `ResearchFields`). `src/core/components/limit.ts` holds
  `Limit` and `room`; `src/core/components/energy-threshold.ts` holds
  `EnergyThreshold`, `energyNeed` and `energyShort`. `catalog.ts` derives
  `LIMIT` (the defense with `limit`, by key) and builds `DEF` with
  `once: true` for a `limit` of 1 and `BUILD` and `RES` with `energy` from
  `energyThreshold`, deeply equal to before; `unitRoom` reads `LIMIT`
  through the rule module (own keys only), `requirements.ts` imports the
  energy check from the rule module, and `yard.ts` and `research.ts` keep
  their exports.
* **[E]** Choices of the limits group within the decisions above,
  confirmed by the owner (2026-11-14): `limit` is only on defense, because `unitRoom` counts
  the stock in the planet's defense, and the contract test checks this and
  a whole `perPlanet` ≥ 1; `energyThreshold` is only on buildings and
  research, the entries with levels; the table field `once: true` is
  derived from `perPlanet === 1` instead of being kept twice in `def`.
* **[E]** Decided for the last pull request of #114, `ProducerTable`
  (owner, 2026-11-14): the rows of the resources page come from a core
  function `producerRows()` in `economy.ts` with the same list, energy
  factor `f` and throttled share as `prod()`: per entry its level or
  number, share, production and use, plus the row of the base income from
  `BASE_INCOME`; a property test checks that the rows add up to `prod()`.
  Text and numbers stay, the E2E tests unchanged; the label is „(Stufe n)“
  for a building and „(n)“ for a ship, and the plural „Sonnenreliquiare“ is
  a text field of the entry. `ProducerTable.svelte` is mounted like
  `Buildings.svelte`. `rates.ts` stays the shared formula module of the
  entries. The displays with a fixed key become generic with the same
  text: the shipyard shows the energy of one piece from `produces.e` with
  „je Reliquiar“ from the texts of the entry, the buildings the use per
  hour at the next level from `consumes`. The test that scans `src` for
  comparisons with a key has a named allow-list (file, key, count, issue)
  whose counts may only fall: `settle.ts` (`nextSatellite`, `techChange`),
  `server/game/actions.ts` and `balancedShare` with #115, the check of the
  Spähschädel with #116, the lab and shipyard locks with #183 („Lab lock
  and shipyard lock without catalog keys“, owner, 2026-11-14).
* **[E]** Built with #114 (ProducerTable): `producerRows(p, u, research)`
  in `src/core/economy.ts` returns `f`, the base income times the universe
  speed and one row per entry of `PRODUCTION` in the production order:
  key, kind, level (a ship's number), share as it runs, `throttled`, and
  `made` and `used` with the rates the entry has (a resource made times the
  universe speed, as `prod()` adds it). It runs on the planet as
  `production()` runs it, with the throttled Fusionskraftwerk. `useAt()`
  gives the resource use per hour of an entry at a level from `consumes`,
  `pieceEnergy()` the energy of one piece of a ship with `produces.e`.
  `EntryText` has the optional fields `plural` and `per`; the
  Sonnenreliquiar has „Sonnenreliquiare“ and „je Reliquiar“. The browser
  no longer calls `rates.ts`. `balancedShare` names the key only as a
  share (`pct.fusion`), not in a comparison, so the scan has no entry for
  it; it stays for #115.

* **[E]** Built with #53 (first pull request, owner's decisions of
  2026-11-13 and 2026-11-14): the component `placement` is the list of the
  kinds of place where a building can stand (`'planet'`, `'moon'`); a
  building without it stands on planets only. `src/core/components/
  placement.ts` holds `Placement`, `PLANET_ONLY` and `placeable`, its
  contract test checks that only buildings carry it and that it names known
  kinds once each. `catalog.ts` derives `PLACEMENT` and `buildable(key,
  kind)`; the build action, the requirements list and the buildings page
  ask `buildable`. The Mondzitadelle adds fields through the existing
  `fields` of `BuildingFields`, like the Weltenschmiede.
* **[V]** Built with #54 ([Missiles](/features/missiles.md)): the
  components `silo` (`{ slots }`, places per level, buildings only) and
  `missile` (`{ slots, intercepts? }`, defense only) with one rule module,
  `src/core/components/silo.ts`, and its contract test; `catalog.ts`
  derives `SILO` and `MISSILE`, and `FIGHTERS` leaves the missiles out
  (`fights(key)`); `yard.ts` asks the module for the room of the silo.
* **[V]** Built with #183 (lab lock and shipyard lock without catalog
  keys; the owner left open whether they become a component, how the lab
  lock fits the rule of two entries and the release, 2026-11-14; the
  recommendation was taken, no behaviour changes): the component `locks`,
  `{ stops: 'shipyard' | 'research', home?: true }`, on buildings only. An
  upgrade of such a building stops what it names while it runs, and waits
  until that is idle; `home` marks the building that is the place of it (the
  Schiffsschmiede for the shipyard, the Scholarium for the research), exactly
  one per kind. Three entries share it (Schiffsschmiede, Machina-Schwarmhalle,
  Scholarium), so the rule of two entries holds, with two kinds of lock. The
  rule module is `src/core/components/locks.ts` (`stops`, `stoppers`,
  `homeOf`) with its contract test; `catalog.ts` derives `LOCKS`; `lab.ts`
  and `yard.ts` keep their exports (`hasLab`, `labUpgrading`, `waitsForLab`,
  `hasYard`, `yardLockedBy`, `waitsForYard`, `YARD_LOCK`) and read the
  component, `hasLab` and `hasYard` the level of the `home` building
  (`YARD_HOME`). The name of a lock in a message is the short text `short`
  of the entry (the Schiffsschmiede, whose name is „Orbitale Schiffsschmiede“),
  else its name; `YARD_LOCK` is derived from them with today's values, and
  `lockNotice()` compares with `YARD_HOME`. `src/core/locks-reference.test.ts`
  compares every rule with its form before, for every key of the catalog and
  inherited names.
