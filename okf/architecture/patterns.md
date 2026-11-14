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
  comparisons with a key has a named allow-list (file, key, issue) that may
  only shrink: `settle.ts` (`nextSatellite`, `techChange`),
  `server/game/actions.ts` and `balancedShare` with #115, the check of the
  Spähschädel with #116, the lab and shipyard locks with a new issue.
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

## 4. Missions: one strategy per mission

* **[E]** A mission is a file with `canSend(fleet, target)` (pure, in
  `src/core`, used by server and browser) and `onArrive(ctx, fleet)`
  (server only). A registry replaces the `if` chain in
  `src/server/game/arrival.ts`.

## 5. Battle: pure function, consequences as a fixed pipeline

* **[E]** `battle()` takes any number of parties and returns the losses per
  party. The consequences run as a fixed pipeline of pure steps: debris,
  moon chance, rebuilding defense, reports.
* **[E]** No event bus: the order must stay deterministic with the seeded
  `rng`.

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
  2026-11-12).
* **[V]** `distance()` already returns 5 for the same coordinates, which is
  the distance planet ↔ moon (#53). A moon is removed with its planet by
  its coordinates; no parent column is needed. Missions check the kind of
  the target in `canSend`; `placement` and `fields` read it for moons.

## 7. Server actions: commands

* **[E]** The command map `ACTIONS` (`src/server/game/dispatch.ts`) stays.
  Every check of an action is a pure function in `src/core` that returns an
  error code; server and browser turn it into the German message (as
  `yard.ts`, `lab.ts` already do).

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

## 10. Layout and registration

* **[E]** Core in layers, entries as feature folders:

```
src/core/                  economy, settle, battle, flight, components/
src/features/<key>/        entry.ts, texts.de.ts, *.server.ts, *.test.ts
src/features/missions/<m>/ rules.ts, arrive.server.ts, *.test.ts
src/features/index.gen.ts  generated index, not checked in
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
  literal or a const bound to one. Its allow-list `ALLOWED` names file, key
  and issue; an entry no longer hit fails, so the list only shrinks. The
  placeholder `TODO-issue` marks the lab and shipyard locks until their
  issue exists; `TODO-owner` marks words equal to a key that are no
  catalog key (the mission and report type `spy`, the state `energy` of a
  building or research), open for the owner.

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
  4. Generic events in `settle` with the property tests.
  5. Missions as strategies.
  6. Repositories per aggregate.
  7. Client state module and generic components; `main.ts` shrinks per view.
  8. Places (O11), its own pull request before #45 and #53 (owner,
     2026-11-12). Built with #119.

* **[E]** The battle with several parties is no migration step; it is built
  with #55.
