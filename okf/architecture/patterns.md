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
  component, for example the rate formula of `produces` or
  `drive: (research) => DriveKey` of `mobile`. There are no free hooks
  (`onBuild`, `onSettle`): they bring the scattered special cases back.
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
  and the remaining fields as `def`; `catalog.ts` adds the texts of the key
  from `src/core/texts.ts` (#113 moves them). `src/core/components/`
  holds `leveled.ts` (`lvlCost`, `sumLevels`), `storage.ts` (`capOf`,
  `capacities`), `produces.ts` (`BASE_INCOME`, `energyMade`, `made`: base
  income plus the rates times the universe speed, never below 0) and
  `consumes.ts` (`energyUsed`, `left`); `economy.ts` keeps its exports and
  composes them in `prod()` and `caps()`. `PRODUCTION`, `STORAGE` and
  `PRODUCERS` are derived from the components; `PRODUCERS` stays deeply
  equal (it was [V] in #114). The level of a ship in a rate is its number on
  the planet (Solarsatellit).
* **[V]** Choices of #114 within the decisions above, for the owner to
  confirm: the `order` values step by 10 (room for new entries without
  renumbering); the production order is the field `order` of `produces`,
  and an entry that consumes also produces (contract test); the formulas
  the rates share (`growth`, `grows`, Solarsatellit and Fusionskraftwerk)
  are in `src/core/rates.ts`, because the resources page and the shipyard
  still show them until `ProducerTable`; the throttle of the
  Fusionskraftwerk (`balancedShare`) still names its key and becomes
  generic with the events of #115.

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

## 9. Client: generic Svelte components

* **[E]** One state module with Svelte 5 runes (`.svelte.ts`) replaces the
  module variables of `src/client/main.ts`; one component per view.
* **[E]** Generic components render from the catalog: `CatalogList`
  (buildings, research, shipyard, defense) and `ProducerTable` (resources).
  A new entry needs no new HTML.
* **[E]** The catalog views are converted first (buildings, research,
  shipyard, defense), where #45, #51 and #53 add the most; then the other
  views (owner, 2026-11-13, #118).

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
  Since #114 every catalog entry has its folder with `entry.ts`.
  `scripts/gen-features.ts` writes `src/features/index.gen.ts` with
  `ENTRIES` (each `<key>/entry.ts`) and `MISSIONS` (each
  `missions/<m>/rules.ts`) as lists of `[key, module]` pairs sorted by key.
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

# Migration

* **[E]** The running release (milestone `next release`) is built as
  before; the migration converts its entries afterwards. The migration
  starts after that release, as infrastructure issues (the release loop
  puts infrastructure first, [Release loop](/ops/loop.md)).
* **[E]** Order, each step one small pull request without a change of
  behaviour (equivalence and E2E tests green); the owner confirmed it on
  2026-11-13 (#111): #112 first; then #113, #114, #116, #117 in parallel;
  #68 before #116, #117 and #118; #114 before #115; #113 and #114 before
  #118; #117 before #119 before #45 and #53 (and #95):
  1. Folder skeleton, generated index, boundary rules.
  2. Texts apart from rules (after #94).
  3. Components of the catalog with contract tests; production from the
     components; the resources page from `ProducerTable`. One pull request
     per component group: production (`produces`, `consumes`, `storage`,
     `leveled`), combat (`combat`, `unit`), flight (`mobile`), limits
     (`limit`, `energyThreshold`), then `ProducerTable` (owner, 2026-11-13,
     #114). The production group is built (#114, first pull request).
  4. Generic events in `settle` with the property tests.
  5. Missions as strategies.
  6. Repositories per aggregate.
  7. Client state module and generic components; `main.ts` shrinks per view.
  8. Places (O11), its own pull request before #45 and #53 (owner,
     2026-11-12).

* **[E]** The battle with several parties is no migration step; it is built
  with #55.
