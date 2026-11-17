---
type: Architecture
title: Design patterns
description: The patterns the code follows so that the planned features (issues #45 to #95) are added as new files with generic rules instead of special cases, and parallel work does not collide.
tags: [architecture, patterns, catalog, economy, missions, client]
status: draft
generated: { by: claude-code/web, at: 2026-11-12T15:00:00Z }
---

# Why

The open issues bring the same kinds of rules again and again (read on
2026-11-12: #21, #45 to #47, #49 to #60, #63, #78, #93 to #95):

| Mechanic | Issues |
|---|---|
| Producers and consumers with their own formula (temperature, research, share) | #46, #47, #52 |
| Energy as a threshold: produced, not consumed | #49 (Gravitonforschung), #51 (Terraformer) |
| Limits: once per planet, fields taken or given, silo slots, planet or moon only | #50, #51, #53, #54 |
| Values that depend on research (drive change) | #57, #58 |
| A unit that never flies but fights | #46 |
| New missions with their own conditions | #45, #55, #93, #95; #54 (missiles, no fleet) |
| New places: moon, debris field, position 16 | #45, #53, #93 |
| Battle with several parties and consequences (debris, moon chance, missiles) | #45, #53, #54, #55 |
| Texts apart from rules (renaming, long explanations) | #63, #94 |
| Points per category | #78 |
| Admin parameters of rules | #45 D2, #51 D4 |

Without a pattern each of them becomes an `if (key === …)` in a shared
file, and parallel pull requests collide in `src/core/catalog.ts`.

**[E]** The owner chose the goals (2026-11-12): reuse inside Nova Imperium
only (no package for other projects); all layers (rules, game, store,
client); Svelte stays the client direction; fast iteration means parallel
work without merge conflicts and small pull requests. The owner left the
choice of the patterns to the assistant's recommendation below
(2026-11-12).

# Decisions

## 1. Catalog: typed composition

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

## 2. Texts apart from rules

* **[E]** Name, abbreviation, short and long description of an entry live in
  its own text file (`texts.de.ts`), keyed by the entry key. Rules contain
  no German text. Renaming (#94) and explanations (#63) then never touch a
  rule file.
* **[V]** First step (#131, owner 2026-11-12: display texts are not
  mutation-tested): the display texts of the catalog and the mission names
  are in `src/core/texts.ts`, keyed by the entry key, and each catalog
  entry spreads its texts; Stryker leaves the file out (see
  [Test strategy](/ops/testing.md)). The per-feature `texts.de.ts` follow
  with the folder skeleton.
* **[E]** #113 builds on `src/core/texts.ts` of #131 (all display texts
  in one data file that Stryker leaves out): after #112 it splits that file
  into one `texts.de.ts` per entry and adds the accessor `text(key)`; the
  text files stay out of the mutation run (owner, 2026-11-13).
* **[E]** Decided for #113 (owner, 2026-11-13): the mission names stay in
  `src/core/texts.ts`, still left out by Stryker, until #116 moves them into
  the mission folders; `text(key)` covers the catalog entries only (`spy` is
  both a research and a mission). The 12 classic ships and defenses that
  never had a short text get one in #113 (see
  [Grimdark naming](/features/naming.md)); after that every entry needs a
  name, an abbreviation and a short text.
* **[E]** Built with #113: every entry folder holds `texts.de.ts` beside
  `entry.ts`; `scripts/gen-features.ts` stops on an entry folder without
  either, and lists the text files as `TEXTS` in the generated index beside
  `ENTRIES`. `src/core/text.ts` holds the type `EntryText` (`n`, `ab`, `ds`,
  optional `lt`) and `text(key)`, undefined for a key that is no entry;
  server and browser read every name, abbreviation, short and long text
  through it, and `BuildingDef`, `ResearchDef`, `ShipDef` and `DefenseDef`
  hold no text. Stryker leaves `src/features/**/texts.de.ts` out like
  `src/core/texts.ts`; `src/core/text.ts` is mutated.
  `src/core/text.test.ts` fails on a missing name, abbreviation or short
  text, an abbreviation used twice, a text file without an entry and a text
  field in a rule.
* **[E]** Choices of #113 within the decisions above, confirmed by the
  owner (2026-11-13): each `texts.de.ts` exports one object `texts` typed with
  `EntryText` (not single exports `n`, `ab`, …), so the compiler checks
  every file on its own; the index has its own list `TEXTS` instead of a
  third element in `ENTRIES`; the accessor is its own file `text.ts`,
  because `texts.ts` is not mutated.
* **[E]** Decided for #116 (owner, 2026-11-14): every mission folder holds a
  `texts.de.ts` with its name; the generator lists them as `MISSION_TEXTS`;
  the accessor `missionText(m)` stands next to `text(key)`, so that
  `text('spy')` stays the research. `src/core/texts.ts` is removed, and
  `MISSION` moves from `catalog.ts` to `src/core/missions.ts`.
* **[E]** Built with #116: `src/features/missions/<m>/texts.de.ts` exports
  `texts` typed with `MissionText` (`n`, the name), like the entry texts;
  `missionText(m)` is in `src/core/text.ts`, undefined for a name that is no
  mission. `MISSION` (`src/core/missions.ts`) builds the names in the order
  of the rules; `catalog.ts` re-exports it for the existing imports of the
  tests. Stryker leaves the mission texts out through the existing glob
  `src/features/**/texts.de.ts`.

## 3. Economy: piecewise linear with generic events

* **[E]** `settle` moves time forward in segments. Inside a segment all
  rates are constant; the rates come from the `produces` and `consumes`
  components, the energy factor `f` and the shares.
* **[E]** A segment ends at the next event: a queue finishes, or a stock
  reaches its storage limit or 0. With constant rates the time of a stock
  event is `distance / net rate`, so the events are generic.
* **[E]** The only own mathematics is the throttled consumer of
  Fusionskraftwerk (#47 D1, owner 2026-11-12): the share where use equals production, a fixed point through
  `f`. It is one function with its derivation and tests.
* **[E]** Property tests (fast-check): settling in two steps equals settling
  in one (`settle(settle(p, t1), t2) = settle(p, t2)`); a stock never goes
  below 0; without consumers the order of the floating point operations is
  the one of version 1, so the equivalence tests stay unchanged.
* **[E]** The browser computes no formula of its own. Today
  `src/client/views/economy.ts` repeats the production formulas instead of
  calling `prod()`; the resources page will build its rows from the
  components.
* **[E]** Built with #114 (ProducerTable): the resources page shows the
  rows of `producerRows()` (`src/core/economy.ts`), the sums of
  `production()` and the limits of `caps()`; the shipyard and the
  buildings read `pieceEnergy()` and `useAt()`. The browser repeats no
  production formula.
* **[E]** Built with #115: no rule of `src/core/settle.ts` names a key. A
  production segment ends at the end of the building, when the shipyard
  finishes a unit with production components (a key of `PRODUCERS`, today
  the Solarsatellit), when a research finishes that a rate of an entry on
  the planet reads, and, in `accrue()`, when a use empties a stock. The
  stocks that can run empty and their consumer come from the `consumes`
  components (`STOCK_USERS` in `src/core/economy.ts`); `throttle()` gives
  the consumer at an empty stock that would fall with its throttled share,
  `balancedShare()` takes that consumer and resource (no `pct.fusion`), and
  `production()` keeps that stock at 0. The server settles the planets
  whose production a finished research changes, now or once their building
  is finished (`feelsResearch()`, `settleResearchEnd()` in
  `src/server/game/actions.ts`), before a new research replaces it. The
  equivalence tests of version 1 are unchanged and green.
* **[E]** Choices of #115 within the decisions above, confirmed by the
  owner (2026-11-14): a research changes the production when a rate of an
  entry with level or number above 0 reads its level, found automatically
  (`readsResearch()`: the rates run once on research levels that note what
  is read, a JavaScript `Proxy`; no new field in a component). A stock
  that reaches its storage limit stops inside the segment (`addUp`,
  `min(stock + change, max(stock, limit))`) and splits nothing, because no
  rate depends on a full stock and a split would change the floating point
  order of version 1. The contract test of `consumes` allows one entry
  that uses a stock (m, c, d) until a second consumer comes; how several
  consumers share an empty stock, or two stocks run empty, is then decided
  with the owner. Settling in steps equals settling in one step within the
  tolerance of #47 (1e-6 + 1e-9 relative) in every case, not only the
  throttled one: version 1 already rounds the production of two segments
  differently from one, so it is not bit-identical even without a
  consumer. The comparison with the code before #115 stays bit for bit.

## 4. Missions: one strategy per mission

* **[E]** A mission is a file with `canSend(fleet, target)` (pure, in
  `src/core`, used by server and browser) and `onArrive(ctx, fleet)`
  (server only). A registry replaces the `if` chain in
  `src/server/game/arrival.ts`.
* **[E]** Decided for #116 (owner, 2026-11-14):
  * Form: each `src/features/missions/<m>/rules.ts` exports `canSend` and
    typed data: the order, the target kind (own, foreign, any, free), cargo
    yes or no, return yes or no, ships visible to the defender yes or no,
    silent return yes or no. Data, no free hooks. **[V]** #169 adds one
    more typed field, `alertsGuild` (whether the launch writes an event
    into the chat of the defender's guild; the attack only), so the server
    asks the rules, not the mission's name.
  * Send check: `canSend` returns an error code or nothing. The server
    determines the noob protection and turns the codes into today's German
    messages, in today's order. Slots, cargo and fuel stay generic. The
    fleet form keeps offering every mission (replaces the [V] of #116 that
    the fleet view offers only what `canSend` allows).
  * Arrival: the dispatcher in the server's arrival code checks generically
    through the target kind whether the target still fits, else „Flotte
    kehrt um“. Colonize gets the raw target, the others the settled target,
    in today's order and with the same random draws.
  * Order: an `order` field in each `rules.ts`, in steps of 10; order and
    preselection of the fleet form stay (attack, transport, spy, colonize,
    deploy; the first preselected).
  * Server registry: `gen-features` also writes
    `src/features/index.server.gen.ts` (`MISSION_SERVERS`), not checked in;
    every mission needs an `arrive.server.ts`; only `src/server` imports
    that index (dependency-cruiser).
  * Type `Mission`: a type-only derivation from the generated index, if the
    rule `no-circular` allows it (else the question comes back).
  * Texts: see section 2.
* **[E]** Built with #116: five folders `attack`, `transport`, `spy`,
  `colonize`, `deploy`, each with `rules.ts`, `texts.de.ts`,
  `arrive.server.ts` and a test of its own `canSend` and `onArrive` (seeded
  random, fixed clock). The data: attack 10, foreign, cargo, return,
  visible; transport 20, any, cargo, return; spy 30, foreign, no cargo,
  return, silent (it comes home without a report of its own unless
  recalled); colonize 40, free, cargo, return; deploy 50, own, cargo, no
  return. Only `canSend` of spy (only Spähschädel, `probesOnly`) and of
  colonize (a Kolonistenarche, `noColonyShip`) check anything; the others
  return nothing.
  `src/core/missions.ts` holds the types (`TargetKind`, `SendError`,
  `SendFleet`, `SendTarget`, `MissionRules`), `missionRules(m)` from the
  index, `MISSION`, `suits(kind, owner, planet)` and `sendError(rules,
  fleet, target)`: first the target kind (occupied; no planet, same planet,
  not own, own target, noob protection), then the mission's `canSend`. The
  server passes the noob protection as `protects(owner)`, asked only for a
  foreign target after the other checks, so the points are computed as
  rarely as before; `fleet-actions.ts` maps each code to its message.
  `src/server/game/arrival.ts` reads `onArrive` from `MISSION_SERVERS`;
  the target fits by `suits` and, for a free target, by a position inside
  the universe (the check colonize had); a free target gets no arrival
  (`null`, nothing is there), the others `{ t, att, def }` with the settled
  planet. The coming home reads `silent`, the view of a foreign fleet
  `visible`, the cargo of a send `cargo`, the fleet form `order`, `target`
  („Freie Position“) and `returns` (no return time). `MissionServer`,
  `Arrival`, `turnBack`, `land` and `researchAt` are in
  `src/server/game/missions.ts`; `arrival.ts` still exports `spyScore`,
  `counterChance`, `rebuild` and `plunder`, which moved to the spy and
  attack folders. A fleet of an unknown mission throws and `tick` removes
  it; the database allows only the five missions. No `f.mission ===` is
  left outside the mission folders.
* **[E]** Built with #45, within the decisions of #116: the sixth folder
  `harvest` (Bergung, 60) with the target kind `debris` beside own,
  foreign, any and free. `SendTarget` carries `debris` (a Trümmerfeld lies
  at the position); `sendError` checks only that for the kind `debris`
  (`noDebris`), whatever planet is there, then `canSend` (`noRecycler`).
  `suits` takes the field as a fourth argument. A fleet of the kind
  `debris` flies to the place `d<g>_<s>_<p>`; at the arrival the dispatcher
  turns it back when the field is gone, with the text of #45, and else
  hands it no arrival (`null`), like a free target, because a field is no
  planet. Migration 16 allows `harvest` in the database
  (see [Trümmerfelder](/features/debris.md)).

## 5. Battle: pure function, consequences as a fixed pipeline

* **[E]** `battle()` takes any number of parties and returns the losses per
  party. The consequences run as a fixed pipeline of pure steps: debris,
  moon chance, rebuilding defense, reports.
* **[E]** No event bus: the order must stay deterministic with the seeded
  `rng`.
* **[E]** Built with #53: the moon step follows the debris step and comes
  before the rebuilt defense: at a planet without a moon the chance of the
  whole field is rolled once when it is above 0, and a hit draws the
  diameter (`src/core/moon.ts`, `rollMoon` in `src/server/game/moons.ts`).

## 6. Places

* **[E]** A place is coordinates plus a kind:
  `Place = Coords & { kind: 'planet' | 'moon' | 'debris' }` (O11, owner,
  2026-11-12).
* **[V]** The id stays derived from the place, with the kind as prefix:
  `placeId()` replaces `pid()` and gives `p1_2_3`, `m1_2_3`, `d1_2_3`.
  Existing planet ids already start with `p` and stay unchanged.
* **[V]** A moon is a row of `planets` with `kind = 'moon'`; buildings,
  ships, defense and queues hang on it through `planet_id` as for a planet.
  `UNIQUE (g, s, p)` becomes `UNIQUE (g, s, p, kind)`, which in SQLite needs
  a rebuild of the table (append-only migration with the upgrade tests).
* **[E]** Debris fields get their own table: no owner, no buildings, no
  production (owner, 2026-11-12).
* **[E]** Decisions after the first build attempt of #119 (owner,
  2026-11-13):
  * Debris table `debris (id TEXT PRIMARY KEY, g, s, p INTEGER NOT NULL,
    res_m REAL NOT NULL, res_c REAL NOT NULL, UNIQUE (g, s, p)) STRICT`,
    created empty. The id is `d<g>_<s>_<p>`, so a fleet can target it like
    a planet; one row per position, because a field adds up (#45); only
    Adamant and Psikristall (#45); REAL like the planet stocks, so the 30 %
    share is not rounded.
  * `planets.kind TEXT NOT NULL DEFAULT 'planet' CHECK (kind IN ('planet',
    'moon'))`; debris has its own table. `UNIQUE (g, s, p)` becomes
    `UNIQUE (g, s, p, kind)`.
  * `Planet` gets `kind: 'planet' | 'moon'`. The planet repository reads it
    and writes it on insert, never in the update part of the upsert. The
    galaxy list and the client stay unchanged.
  * `parsePlaceId(id): Place | null` is the inverse of `placeId()`: null for
    anything that is not a canonical `[pmd]<g>_<s>_<p>` (positive integers,
    no leading zeros), so that `placeId(parsePlaceId(x)) === x`; it never
    throws on untrusted ids.
  * The kind of a fleet's origin and target comes from the prefix of
    `from_planet` and `to_planet`; the fleets tables do not change.
* **[E]** Built with #119: `Place` in `src/core/types.ts`, `placeId()` and
  `parsePlaceId()` in `src/core/place.ts` (`pid()` is gone from
  `flight.ts`; its five uses build a place of kind `planet`). Migration 15
  rebuilds `planets` with `kind` and its four child tables
  (`planet_buildings`, `planet_units`, `planet_production`,
  `shipyard_queue`) and `planets_owner`, because migrations run with
  `foreign_keys = ON` and dropping the old `planets` would delete their
  rows; every planet keeps its id and becomes kind `planet`. It adds the
  empty table `debris`; no code reads or writes it before #45 (see
  [SQLite storage](/data/sqlite.md)).
* **[E]** Position 16 (expeditions, #93) is decided with #93 (owner,
  2026-11-12). Decided there (owner, 2026-11-16, #93 Q4, Q5): the
  expedition position is the position right after the last planet position
  of the universe (16 with 15 planet positions, 21 with 20), one per system,
  never a planet position, so it takes no colonizable position away; it
  cannot be colonized, is only the target of expeditions and of a Bergung of its Trümmerfeld and is visible in
  the Sternenkarte; battles of an expedition leave a Trümmerfeld there
  ([Expeditions](/features/expeditions.md)).
* **[E]** Built with #53: a moon is a row of `planets` with the kind
  `moon` and the id `m<g>_<s>_<p>`, without a new migration; the send
  request names the kind of the target (`to.kind`), and the fleet keeps it in
  the prefix of `to_planet`. `planets.home()` takes only a planet.
* **[V]** `distance()` already returns 5 for the same coordinates, which is
  the distance planet ↔ moon (#53). A moon is removed with its planet by
  its coordinates; no parent column is needed. Missions check the kind of
  the target in `canSend`; `placement` and `fields` read it for moons.

## 7. Server actions: commands

* **[E]** The command map `ACTIONS` (`src/server/game/dispatch.ts`) stays.
  Every check of an action is a pure function in `src/core` that returns an
  error code; server and browser turn it into the German message (as
  `yard.ts`, `lab.ts` already do).
* **[V]** Built with #53 (second pull request): an action may answer data
  besides its message, `{ msg, data }` (`Answer`, `answerOf` in
  `src/server/game/actions.ts`); `POST /api/action` adds `data` to the
  reply only then, and the client's `act()` hands it to `answer` before it
  applies the state, only for the newest action of its type: the data of a
  scan that a newer scan overtook is dropped, its state still applies
  (CodeRabbit review of #217). First user: the scan of the Auspex-Phalanx, whose
  check `scanError` is a pure function of `src/core/phalanx.ts` and whose
  reach `scanReach` the Sternenkarte asks too.
* **[E]** Audited with #214 on 2026-11-15:
  [Checks of the server actions](/architecture/action-checks.md) lists the
  33 actions of `ACTIONS` with where their checks live, what the browser
  repeats and whether the messages match. 7 follow this section, 13 are
  split between `src/core` and the server, 13 check inline only; 17
  findings where browser and server disagree. **[V]** The follow-up pull
  requests, one per group (economy, fleet, rewards, admin, player, guild),
  are planned there.
* **[E]** Economy group built (#214, 2026-11-16): `buildErrors`,
  `researchErrors`, `orderErrors` and `isProducer` in
  `src/core/economy-checks.ts` return every code that applies; the server
  refuses with the message of the first, the lists of the browser show the
  note of the first in their order. Build and research check in one order
  on both sides, and an order of 0 gets the browser's text on the server
  too (O18 (c): F8, F9, F10).

## 8. Store: a repository per aggregate

* **[E]** One repository per aggregate (planet, fleet, player, guild, …)
  instead of the single `Store` class. The SQLite transaction of
  `runAction` is the unit of work. `Ctx` carries the repositories.
* **[E]** The aggregates are cut by game object (owner, 2026-11-13, #117):
  players and accounts; planets with buildings, ships, defense and queues;
  fleets; reports; guilds; invitations and admin data. The exact cut follows
  the code in the pull request.
* **[E]** Tests use SQLite in memory, no hand-written fakes.
* **[E]** Decisions after the first build attempt (owner, 2026-11-13, #117):
  * Scope: the methods of `Store` plus the aggregates of the cut that lived
    outside it, guilds (`guilds.ts`) and admin data (audit, moderation,
    settings). Achievements, push, passkeys, account security, error log,
    news and diagnostics stay raw SQL through `ctx.db`; follow-up issues
    move them.
  * `Store` becomes a thin facade: it composes the repositories and keeps
    every former method name, plus `db` and `tx`. It is used only by tests,
    `e2e/seed.ts`, `cli.ts` and `server.ts`; the store, migration and
    E2E-seed tests stay unchanged.
  * `Ctx` has flat fields: `players`, `planets`, `fleets`, `reports`,
    `guilds`, `invitations`, `admin`, plus `tx(fn)` and `db` for the SQL
    not moved yet.
  * Short method names per aggregate, for example `planets.get(id)`,
    `planets.home(uid)`, `planets.ofOwner(uid)`, `planets.all()`,
    `planets.save(p)`, `fleets.due(now)`.
  * The cut: players and accounts take users, user research, sessions,
    passkeys, passkey challenges and account tokens; admin data takes
    settings (universe), audit events, suspensions, player activity and
    error events; planets also take `usedSize`.
  * Tests: `ctx.store.x` is rewritten mechanically to the repositories, no
    assertion changed; the existing extra transactions stay, through
    `ctx.tx`; SQL that moves into a repository loses its own transaction to
    the caller; one test file per repository against SQLite in memory.
  * Every statement moves verbatim: the same text and parameter order, no
    rewrite, no optimisation, no new index. One exception, same text and
    parameter: `DELETE FROM guild_members WHERE user_id = ?` stood three
    times in `guilds.ts` and is now the one method `guilds.removeMember`.
* **[E]** Built with #117: `src/server/db/repos/` holds one file per
  aggregate, each a typed interface (`Players`, `Planets`, `Fleets`,
  `Reports`, `Guilds`, `Invitations`, `Admin`) and its better-sqlite3 class;
  `repositories(db)` in `index.ts` builds them on one connection, `rows.ts`
  maps rows. `createCtx(store)` spreads `store.repos` into `Ctx` with
  `db` and `tx`. No repository calls `transaction`: the `runAction`
  transaction stays the unit of work, and the other existing transactions
  (audit, activity, account security, news, push, achievements, account
  deletion, arrivals, registration) stay where they were. The game logic of
  guilds, round, audit and moderation stays in its file; only the SQL
  moved. Players and admin data hold sessions, audit and moderation SQL, so
  they are security files of the mutation standard (90 %); so are the
  invitations, whose tokens decide who may register (owner, 2026-11-13).
  Still raw
  through `ctx.db`: `achievements.ts`, `push-store.ts`, `web-push.ts`,
  `passkeys.ts`, `account-security.ts`, `error-log.ts`, `error-export.ts`,
  `news.ts`, `diagnostics.ts`, `delete-account.ts`, `game/admin.ts` (new
  round), the `UPDATE users` of `auth.ts` and the health check of
  `http/app.ts`.

## 9. Client: generic Svelte components

* **[E]** One state module with Svelte 5 runes (`.svelte.ts`) replaces the
  module variables of `src/client/main.ts`; one component per view.
* **[E]** `main.ts` must not grow: a CI ratchet keeps its line count at or
  below the limit in `size-ratchet.json`, and every #118 pull request
  lowers the limit as it shrinks `main.ts` (#242, see
  [Test strategy](/ops/testing.md)).
* **[E]** Generic components render from the catalog: `CatalogList`
  (buildings, research, shipyard, defense) and `ProducerTable` (resources).
  A new entry needs no new HTML.
* **[E]** The catalog views are converted first (buildings, research,
  shipyard, defense), where #45, #51 and #53 add the most; then the other
  views (owner, 2026-11-13, #118).
* **[E]** Built with #114 (ProducerTable): `src/client/views/ProducerTable.svelte`
  renders the resources page, one row per entry of `producerRows()`, and
  `mountProducerTable()` (`src/client/views/producer-table.ts`) mounts it
  like `mountBuildings()`; `renderView` in `src/client/main.ts` mounts the
  view `resources` as the second Svelte view and updates it on every
  render. The share selects keep `data-chg="pct"`, `data-k` and
  `data-nokeep`.
* **[E]** Built with #118, first pull request (the four lists, owner D1 of
  2026-11-13): the state module is `src/client/logic/state.svelte.ts`, one
  object `client` with runes. `client.game` (the state of the server) and
  `client.shown` (what the mounted views show) are `$state.raw`, replaced
  as a whole; `client.view` (the view state of the last render, which the
  completion notices compare with), `client.ui`, `client.offset` with
  `client.now()`, `client.lastKey`, `client.completionNotices` and
  `client.completedMenu` are plain fields; `client.forget()` clears what
  belonged to another planet, player or round. `main.ts` keeps no copy of
  them (`S`, `ctx`, `offset`, `lastKey`, `ui` and the two notice lists are
  gone). Every game action goes through one `act()`, built by `createAct()`
  of `src/client/logic/act.ts`, which applies the answer only while the
  player looks at the same planet (`placeOf`, `samePlace`, also used by
  `refresh()`). The views keep `data-act` and the one click handler of
  `main.ts`.
* **[E]** `CatalogList` (`src/client/views/CatalogList.svelte`, mounted by
  `mountCatalogList()`) renders Gebäude, Forschung, Schiffsschmiede and
  Verteidigung from `catalogPage(v, kind)` of
  `src/client/logic/catalog-list.ts` (`CATALOG_VIEWS` maps the views to
  the kinds `building`, `research`, `ship`, `defense`): the title, the line
  below it, the orders of the shipyard and the lock notice, or the notice
  why the planet has no list; then one row per entry of the catalog table
  of the kind (the buildings filtered by `placement`, #53) with its texts,
  icon, explanation, level, cost with the energy of `energyThreshold`, the
  lines (energy and use of the next level, stats of `combat` and `mobile`,
  time) and its action. It replaces `Buildings.svelte`, `buildings.ts`,
  `views/economy.ts` (research), `views/yard.ts` and `itemHTML()` of
  `views/common.ts`. A list is mounted once per view and updated on every
  render (`flushSync`); a fresh render mounts it again, as the HTML views
  render anew, so no number typed into the shipyard stays on another
  planet. The clock moves `client.shown` to the planet of now every second
  for a mounted list, which replaces `updateResearchButtons` and
  `updateShipyardButtons`, and leaves the countdowns of the list to it.
  `lockNotice()` with its comparison with `yard` moved from `yard.ts` to
  `catalog-list.ts`; the allow-list entry of #183 moved with it.
* **[E]** Review of #209 (2026-11-14), each with a test that failed
  before: an action answers `done`, `stale` (it went through, but the
  player left the planet meanwhile) or `failed`; `order` and `send` clear
  their form only on `done` (`actHere` in `main.ts`), so the answer of an
  order on one planet no longer clears the field of another (the base did,
  through `stillOnPlanet` and a `true`). A refresh applies its state only
  when it is the newest one and no action was on its way or started while
  it ran (`sync.refresh()`), so it never brings back a state older than an
  action's answer (the base had this race too); the next refresh follows
  within 4 seconds. The energy a level of a building needs is compared
  with `production()`, as `energyShort()` checks it, not with `prod()`:
  with a throttled Fusionskraftwerk the row showed enough energy while the
  button said „Zu wenig Energie“. The old `Buildings.svelte` had the same
  mismatch, so this is a change of behaviour; its frozen copy for the
  reference test has the same one change, marked.
* **[E]** All four lists follow the clock (owner, 2026-11-14, #118,
  option C „Alle live + Changelog“): in Forschung, Schiffsschmiede and
  Verteidigung the costs and the lists „Benötigt“ now update every second
  as in Gebäude (before, only the buttons and the maxima did), and a
  clicked button keeps its focus, because the list is updated in place;
  not chosen: copying the old split (costs from the last render, buttons
  from the clock), or the same without a changelog entry. The pull request
  brings the fragment `changes/listen-live.md` (`art: geändert`).
* **[E]** Order after the lists (owner, 2026-11-14, #118 „Geklärt,
  Nachtrag 2“): next come the views that the phone view #189 builds on,
  the Übersicht, the header, the Sternenkarte and the navigation (tab bar
  and „Mehr“); **[V]** one view per pull request, and no two views of #118
  are built in parallel.
* **[E]** Built with #118, second pull request (the Übersicht):
  `src/client/views/Overview.svelte`, mounted by `mountOverview()`
  (`src/client/views/overview.ts`), renders the overview from
  `overviewPage(v)` of `src/client/logic/overview.ts`: the title, the
  fleet movements (`fleetRows()`, the owner of a foreign fleet as a bold
  part, the recall of an own fleet but not of the gift of #161), the
  planet or moon with its picture, kind, position, type, temperature,
  diameter with the fields, points with the place, the server time of the
  render, and the activities (`activityRows()`: building, research, the
  next unit of the shipyard). It replaces `overview()` of
  `views/overview.ts`; the fleet view builds its list „Flotten unterwegs“
  from the same `fleetRows()` (only the player's own fleets) and stays
  HTML. Unlike the lists, the overview is mounted anew on every render,
  as its HTML view was rendered anew: the clock of `main.ts` keeps
  counting its countdowns down and marking the ones that fired
  (`data-fired`), and the focus behaves as before, so nothing visible
  changes; `client.shown` is not moved by the clock for it, so
  „Serverzeit“ stays the time of the render. A view that is neither a
  Svelte view nor an HTML view gets the overview, as before.
* **[U]** Left in `main.ts` for the next pull requests of #118: the login
  (`loginChallenge`, `rememberLogin`, `resetToken`), the admin panel
  (`adminPanel`), the mounted Svelte view (`mounted`, a DOM handle),
  `lastActivity`, the install offer (`installPrompt`, `installedHere`,
  `installDismissed`), the news (`newsLoading`, `newsLoad`), the
  maintenance banner (`maintenance`), `planetRequest`, `readPending` and
  `announcementPending`; `client.ui` is not reactive yet, and the
  resources page still gets its view state through a store. The second
  pull request (the Übersicht) moved no variable of this list: the old
  view kept no state in `main.ts`; `mounted` now also holds the overview.
  Bundle 1 (header line, navigation, resource bar) moved none either: the
  old frame kept no state in `main.ts`; `renderMenu` still clears the dot
  of the news (`seeNews`) before it shows the navigation, and `updateBar`
  still returns the planet moved to now for the clock. Bundle 2 (the
  Sternenkarte) moved none either: the old view kept its state in
  `client.ui` (`gal`, `sys`, `gmoon`, `scan`), which stays there;
  `mounted` now also holds the Sternenkarte. Still rendered as HTML: the
  views Flotte, Nachrichten, Highscore, Gilden, Achievements, Neuigkeiten,
  Hilfe & Optionen and Admin.
* **[E]** Bundle 2 after bundle 1 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): the Sternenkarte, which the phone view #189 builds on
  too.
* **[V]** Built with #118, bundle 2 (the Sternenkarte; bundle 1 is
  described below): `src/client/views/Galaxy.svelte`, mounted by
  `mountGalaxy(target, v)` of `src/client/views/galaxy.ts` (which renders
  no HTML any more, and leaves `VIEWS` of `views/index.ts`), renders the
  view from `galaxyPage(v)` of `src/client/logic/galaxy.ts`: the fields
  „Galaxie“ and „System“ (`data-nokeep`) with their steps, „Anzeigen“ and
  „zum Heimatsystem“; the panel of the last scan (#53) with its
  countdowns (`countdown()` of `overview.ts`, rendered by the new
  `Due.svelte`, which the overview now uses too instead of its own
  snippet, so the copy check jscpd finds no clone); one `GalaxyRow` per
  position: the planet (`GalaxyPlace`: name, owner, place in the
  highscore, noob protection, actions), the symbols of the moon and the
  Trümmerfeld (#45, #53), the actions of a free position and the row of
  the open moon; and the Spähschädel of a spying. The actions are data
  (`GalaxyAction`: a link or a button with its attributes, `data-act`
  first, or the name of the shown place); the symbols of the moon and the
  Trümmerfeld, the button „Bergung“ and the pictures keep their HTML of
  `moonMark()`, `debrisMark()`, `harvestButton()`, `moonPicture()` and
  `planetHTML()`, rendered with `{@html}` as the overview renders its
  pictures, so `logic/moon.ts` and `logic/debris.ts` stay as they are.
  The data come as a property (`page`), as for the frame. The view is
  mounted anew on every render (`ANEW` in `main.ts`, with the overview),
  as its HTML was rendered anew: `keepInputs` gives the focus back by id
  (the field „System“ after Enter, the symbol of a moon), the typed system
  does not come back, `paintPlanets` paints the textures and the clock
  counts the countdowns of the scan down, as before. The click actions
  (`gnav`, `ggo`, `ghome`, `gmoon`, `gscan`, `gscanClose`, `gfleet`,
  `gspy`, `selectPlanet`) stay with `data-act` in `main.ts` until package
  8; `gfleet` and `gspy` read their target with `targetOf()` of
  `galaxy.ts`, so `main.ts` shrinks (1,875 to 1,873 lines). No visible
  change.
* **[E]** Bundle 1 next (owner, 2026-11-16; the bundles of #118 „Geklärt,
  Nachtrag 3“): the header line, the navigation (menu, tab bar and „Mehr“)
  and the resource bar, which the phone view #189 builds on.
* **[V]** Built with #118, bundle 1: each part of the frame around the view
  is a Svelte component in its old place of `index.html`, from a pure
  module of `src/client/logic/`, mounted by `src/client/views/frame.ts`
  (`showHeader`, `showNavigation`, `showResourceBar`, `clearFrame` when
  signed out):
  * `Header.svelte` (`#pinfo`) from `headerLine(s, P)` of `header.ts`: the
    shown place with its position, the commander, „Logout“ and, with more
    than one own place, the list „Aktiver Planet“ (`#planet_select`) of
    `ownPlaces()`, the shown place selected; since #241 the list comes
    first and replaces the name and position as text (below);
  * `Menu.svelte` (`#menu`), `TabBar.svelte` (`#tabbar`) and
    `MoreList.svelte` (`#more-list`), each link a `NavLink.svelte`, from
    `navigation()` of `navigation.ts`: the entries of `menu()` and
    `phoneMenu()` (`views/index.ts`), each with its address, whether it is
    open (`class="on"`, `aria-current="page"`) and the mark „!“ of
    `menuHints()` and the news; „Mehr“ open and marked when one of its
    views is;
  * `ResourceBar.svelte` (`#resbar`) from `resourceBar(game, planet, now)`
    of `resource-bar.ts`: Adamant, Psikristall and Promethium of the
    planet moved to now, each with its production per hour, its storage
    and the mark of a full one, and the energy left over and produced.

  The components get their data as properties, not from the state module:
  `client.ui` is not reactive yet, and `client.shown` follows only the
  mounted views. Each part is mounted anew whenever `main.ts` showed it as
  HTML before (the header line and the navigation on every render, the bar
  on every render and every second of the clock), as its HTML was written
  anew: a focused link or the list „Aktiver Planet“ loses its focus on a
  render and the title of the bar is replaced every second, as before, so
  nothing visible changes. `data-act` (`nav`, `moreOpen`, `logout`) and the
  `change` of `#planet_select` stay with the handlers of `main.ts`.
  Updating the frame in place instead is left to a later decision (for
  example with #189). The double display of the active planet (#241) is
  left as it is: the issue is separate, and this bundle changes nothing
  visible.
* **[V]** Built with #241 (see [Interface](/features/interface.md)):
  `Header.svelte` renders the list „Aktiver Planet“ first when
  `headerLine()` gives places, else the name in bold and the position;
  then „ · Kommandant … · Logout“ in both cases. `headerLine()` is
  unchanged. The frozen header of `src/test/frame-reference.test.ts` has
  this one change, marked, as the frozen `Buildings.svelte` has the one of
  #209; the property test still compares every other state with it.

## 10. Layout and registration

* **[E]** Core in layers, entries as feature folders:

```
src/core/                  economy, settle, battle, flight, components/
src/features/<key>/        entry.ts, texts.de.ts, *.server.ts, *.test.ts
src/features/missions/<m>/ rules.ts, texts.de.ts, arrive.server.ts, *.test.ts
src/features/index.gen.ts  generated index, not checked in
src/features/index.server.gen.ts  generated server index (#116), not checked in
src/server/                http, db/repos, game (commands)
src/client/                state, components (generic), views
```

* **[E]** The core folder is `src/core`: #112 renames `src/shared` to
  `src/core` in one pull request that changes every import (owner,
  2026-11-13).
* **[E]** The index of all features is generated by a script and not
  checked in (`.gitignore`). The script runs before `start`, `test`,
  `typecheck`, `build` and in the Dockerfile, chained explicitly in the
  scripts of `package.json` (`node scripts/gen-features.ts && …`), not as
  `pre*` scripts or tool hooks (owner, 2026-11-13, #112). Reason: the server runs
  without a bundler (`node src/server/main.ts`), so there is no glob import,
  and a checked-in generated file still collides between parallel pull
  requests.
* **[E]** Built with #112: the folders `src/features/` and
  `src/features/missions/` exist (`.gitkeep`); no entry has moved yet.
  Since #114 every catalog entry has its folder with `entry.ts`, since #113
  also with `texts.de.ts`.
  `scripts/gen-features.ts` writes `src/features/index.gen.ts` with
  `ENTRIES` (each `<key>/entry.ts`), since #113 `TEXTS` (each
  `<key>/texts.de.ts`), and `MISSIONS` (each `missions/<m>/rules.ts`) as
  lists of `[key, module]` pairs sorted by key.
  A list, not an object, because knip counts a module passed on as a whole
  as used. A folder without its file, or whose name is not a key, stops the
  script. The `*.server.ts` parts are not in this index, because the
  browser uses it too; their registry comes with the first server part
  (#116). The script writes only when the index changed, through a
  temporary file and a rename.
* **[E]** Built with #112, where the index is written first: the scripts
  `start`, `cli`, `build`, `typecheck`, `test`, `test:watch`,
  `test:coverage`, `test:mutation`, `lint:dead`, `lint:deps` and `check`;
  the two E2E server starts (`playwright.config.ts`); the Dockerfile
  through `pnpm build`, and the image copies `src/features`; the CI jobs
  through these scripts (the nightly upgrade test runs `pnpm test <file>`).
* **[E]** Built with #112: Vitest coverage and the Stryker `mutate` globs
  measure `src/features` and leave the generated index out; knip takes the
  index as an entry; jscpd skips it through `.gitignore`; Vite needs no
  setting, it follows the imports. The changelog check counts
  `src/features` as game code.
* **[V]** If the generated index turns out to be a burden, the fallback is
  a hand-kept index, sorted, one line per entry.
* **[E]** Decided for #116 (owner, 2026-11-14): `gen-features` also writes
  `src/features/index.server.gen.ts` with `MISSION_SERVERS`, not checked in
  (`.gitignore`) like `index.gen.ts`; each mission folder needs its
  `arrive.server.ts`; only `src/server` imports the server index. The type
  `Mission` is derived from the generated index as a type only, as long as
  `no-circular` allows it.
* **[E]** Built with #116: a mission folder needs `rules.ts`, `texts.de.ts`
  and `arrive.server.ts`, else the script stops; `index.gen.ts` adds
  `MISSION_TEXTS` beside `MISSIONS`; `generateServer` writes
  `index.server.gen.ts` (`MISSION_SERVERS`, each `missions/<m>/
  arrive.server.ts`), which the script writes with the other index; knip
  takes it as an entry, Vitest coverage and Stryker leave it out, the
  Dockerfile copies it with `src/features`. `Mission` in
  `src/core/types.ts` is `(typeof MISSIONS)[number][0]` through
  `import type`: the cycles it closes (`types.ts` → index →
  `rules.ts` → `missions.ts`) all run through a type-only import, which
  `no-circular` does not count, so the rule passes unchanged.
* **[V]** Built with #285 (Lexicanum): an entry folder may hold an
  optional `lexicon.de.ts`, what the entry adds to its article.
  `gen-features` lists these files in a third index,
  `src/features/lexicon.gen.ts` (`LEXICON`, not checked in), which only
  `src/core/lexicon/` imports (rule `lexicon-index-in-lexicon`), so the
  parts load with the chunk of the Lexicanum and not with the start bundle
  (#242). Knip takes it as an entry, Vitest coverage and Stryker leave it
  out; Stryker leaves the `lexicon.de.ts` files out like the text files
  (see [Lexicanum](/features/lexicanum.md)).

## 11. Boundaries

* **[E]** `.dependency-cruiser.cjs` enforces them in the CI Gate:
  a feature may import `src/core`, never another feature; `src/core` sees
  features only through the generated index; `*.server.ts` only from the
  server. No workspace packages: reuse stays inside the project.
* **[E]** Built with #112 as the rules `feature-not-feature` (a folder
  `src/features/<key>/` or `src/features/missions/<m>/` imports only its own
  files besides the core; the index of all features is no exception),
  `core-sees-features-through-index` and `server-parts-on-server`
  (`*.server.ts` only from `src/server`, other `*.server.ts` and tests).
  The rules that were there stay; `shared-stays-pure` is now
  `core-stays-pure`. `src/test/boundaries.test.ts` runs the real rules on a
  small project per rule: each violation fails, the allowed imports pass.
* **[E]** Built with #112 beyond the first decision and confirmed by the
  owner (2026-11-13):
  `feature-stays-pure` (the files of a feature other than `*.server.ts` and
  tests import neither server nor client, because the core reaches them
  through the index and the browser runs them); `server-not-client` and
  `server-runtime-deps` (no dev dependencies) cover the `*.server.ts` parts
  and `src/features` too; tests may import a `*.server.ts` part.
* **[E]** Built with #116 (owner, 2026-11-14, only `src/server` imports the
  server index): the rule `server-index-on-server` forbids
  `src/features/index.server.gen.ts` to every file outside `src/server`,
  tests included; `server-parts-on-server` lets that index import the
  `*.server.ts` parts. `src/test/boundaries.test.ts` checks both.

## 12. Tests per component

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
  2026-11-14). The entries: `core/lab.ts` `lab` 2 and
  `client/logic/catalog-list.ts` `yard` 1 (in `client/views/yard.ts`
  until #118), the lab and shipyard locks (#183, „Lab
  lock and shipyard lock without catalog keys“). The generic events of
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
  visible and takes cargo only if it carries cargo.
  `src/server/game/missions-reference.test.ts` compares sending, the
  arrival and the coming home with the code from before #116 on generated
  worlds and fleets: the answer or message, every table and the next random
  number.

# Migration

* **[E]** The running release (milestone `next release`) is built as
  before; the migration converts its entries afterwards. The migration
  starts after that release, as infrastructure issues (the release loop
  puts infrastructure first, [Release loop](/ops/loop.md)).
* **[E]** Order, each step one small pull request without a change of
  behaviour (equivalence and E2E tests green); the owner confirmed it on
  2026-11-13 (#111): #112 first; then #113, #114, #116, #117 in parallel;
  #68 before #116, #117 and #118; #114 before #115; #113 and #114 before
  #118; #117 before #119 before #45 and #53 (and #95). #113 starts after
  the first pull request of #114, because the index requires `entry.ts` in
  every entry folder; the other #114 pull requests run in parallel with
  #113 (owner, 2026-11-13, replaces „#113 and #114 in parallel“):
  1. Folder skeleton, generated index, boundary rules.
  2. Texts apart from rules (after #94 and the first pull request of #114;
     built with #113).
  3. Components of the catalog with contract tests; production from the
     components; the resources page from `ProducerTable`. One pull request
     per component group: production (`produces`, `consumes`, `storage`,
     `leveled`), combat (`combat`, `unit`), flight (`mobile`), limits
     (`limit`, `energyThreshold`), then `ProducerTable` (owner, 2026-11-13,
     #114). All groups are built: production (#114, first pull request),
     combat (second), flight (third), limits (fourth) and `ProducerTable`
     (fifth).
  4. Generic events in `settle` with the property tests. Built with #115.
  5. Missions as strategies. Built with #116.
  6. Repositories per aggregate.
  7. Client state module and generic components; `main.ts` shrinks per view.
     First pull request of #118 built: the state module and the four lists
     through `CatalogList` (section 9); the second the Übersicht through
     `Overview` (section 9); bundle 1 the header line, the navigation and
     the resource bar (section 9); the other views follow.
  8. Places (O11), its own pull request before #45 and #53 (owner,
     2026-11-12). Built with #119.

* **[E]** The battle with several parties is no migration step; it is built
  with #55.
