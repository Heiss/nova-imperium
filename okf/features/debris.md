---
type: feature
title: Bergungsbarke, Trümmerfelder and the mission „Bergung“
description: Debris fields from destroyed ships after a battle, the ship Bergungsbarke (classic Recycler) and the harvest mission „Bergung“ (issue #45).
---

# Bergungsbarke, Trümmerfelder and „Bergung“

Issue #45, milestone `next release` (owner, 2026-11-13). Classic values from
the owner's list of 2026-11-09 and the wiki (Recycler, Debris Field,
Harvest); the owner confirmed them on 2026-11-13. Built after the model of
places (#119, O11 in [Open points](/open-points.md)), which stores debris as
a place of its own.

* **[E]** Recyclers and debris fields are no longer non-goals (owner,
  2026-11-13).
* **[E]** Ship „Bergungsbarke“ (classic Recycler) with the classic values:
  cost 10,000 Adamant, 6,000 Psikristall, 2,000 Promethium; attack 1,
  shield 10, hull 1,600; cargo 20,000; speed 2,000; fuel 300; always the
  Promethium-Brennkammer (`comb`), no drive switch; requirements
  Orbitale Schiffsschmiede 4, Promethium-Brennkammer 6, Refraktionsfelder 2;
  rapid fire 5 against Spähschädel and Sonnenreliquiar (the general value of
  `rapid()`) (owner, 2026-11-13).
* **[E]** After a battle, 30 % of the Adamant and Psikristall of every
  destroyed ship of both sides (Sonnenreliquiare included) form a
  „Trümmerfeld“ at the position; no Promethium, no defense (owner,
  2026-11-13).
* **[E]** A Trümmerfeld adds up over several battles and stays until it is
  harvested; an empty field disappears (owner, 2026-11-13).
* **[E]** Mission „Bergung“ only with at least one Bergungsbarke in the
  fleet and only to a position with a Trümmerfeld. Unlike the classic rule,
  the cargo of **all** ships of the fleet counts (owner, 2026-11-13). Both
  resources are taken evenly until the smaller one is used up, then the rest
  of the other (classic). Debris is not protected; the first fleet to arrive
  takes it, a later one gets what is left.
* **[E]** A fleet that finds no Trümmerfeld any more flies back empty, and
  its player gets a report (owner, 2026-11-13).
* **[E]** Sternenkarte: a debris symbol at the position, visible to every
  player, with the tooltip „Trümmerfeld: x Adamant, y Psikristall“, and a
  button „Bergung“ like the button of the Verlegung (owner, 2026-11-13).
* **[E]** Texts (owner, 2026-11-13, proposal A):
  * harvest report: „Deine Bergungsbarken haben x Adamant und y Psikristall
    geborgen.“
  * battle report: „Es entstand ein Trümmerfeld mit x Adamant und y
    Psikristall.“
  * empty field: „An der Position war kein Trümmerfeld mehr.“
* **[E]** Names in the grimdark style of #127: ship „Bergungsbarke“,
  mission „Bergung“, field „Trümmerfeld“ (owner, 2026-11-13).
* **[V]** The abbreviation, the short and the long text of the Bergungsbarke
  and its art are proposed in the pull request and confirmed by the owner.
* **[U]** Existing battles leave no debris afterwards (no retroactive
  fields).

# Built (#45)

Stacked on the missions as strategies (#116, [Design patterns](/architecture/patterns.md),
section 4) and the places (#119).

* Ship: `src/features/recycler/` (key `recycler`, `order` 35, after the
  Kolonistenarche); `unit` 10,000 / 6,000 / 2,000, `combat` attack 1,
  shield 10 (hull 1,600 from the cost), `mobile` cargo 20,000, speed 2,000,
  fuel 300, `comb` without `drives`; `req` Orbitale Schiffsschmiede 4,
  Promethium-Brennkammer 6, Refraktionsfelder 2. No `rf`: 5 against the easy
  targets comes from `rapidFire`. The Weltenbrecher gets 250 against it
  (classic; #60 D4: a rapid fire value is added when both units exist).
* Debris step: `src/core/debris.ts` (`DEBRIS_SHARE` 0.3, `debrisOf(sides)`
  over the losses of both sides, ships only, by `wreck()` of
  `src/core/components/unit.ts`; `isEmpty`). The attack adds it at the
  position after the battle (`ctx.debris.add`, the field adds up) and
  writes it into both battle reports as `debris`; the client shows the
  sentence only when the battle left debris.
* Store: the repository `debris` (`src/server/db/repos/debris.ts`) on the
  table of migration 15: `get`, `all`, `add` (upsert that adds), `save`,
  `delete`, `deleteAll`. Migration 16 rebuilds `fleets` and `fleet_ships`
  for `harvest` in the CHECK of `fleets.mission` (see
  [SQLite storage](/data/sqlite.md)). A new round clears the fields.
* Mission `src/features/missions/harvest/`: `order` 60, the new target kind
  `debris`, no cargo of its own, returns, not visible, not silent;
  `canSend` needs a `recycler` (`noRecycler`). The target kind `debris`
  (`src/core/missions.ts`) checks only that a field lies at the position
  (`noDebris`), whatever planet is there; the fleet flies to the place
  `d<g>_<s>_<p>`. The dispatcher sends a fleet whose field is gone back
  with „Flotte kehrt um“ and the decided text; `onArrive` takes
  `harvest(field, free)` with the free cargo of every ship, saves the rest
  or deletes the empty field, reports and flies home with the debris.
* Sternenkarte: the state carries every field (`debris`) for every player;
  `src/client/logic/debris.ts` gives the symbol (`/icons/debris.svg`, alt
  and title the tooltip), the button „Bergung“ beside the other actions,
  also at an own planet and a free position, and the battle report
  sentence. The fleet form shows the tooltip beside the target, or „kein
  Trümmerfeld“.
* **[V]** Proposals of the pull request, for the owner to confirm:
  * abbreviation `BG`; short text „Birgt Adamant und Psikristall aus
    Trümmerfeldern.“; long text „Die Bergungsbarke zerlegt die Wracks
    vergangener Schlachten. / So funktioniert es: Aus den zerstörten
    Schiffen einer Schlacht wird ein Trümmerfeld. Zur Bergung braucht die
    Flotte eine Bergungsbarke, dann zählt der Laderaum aller ihrer Schiffe.
    Sie fliegt mit der Promethium-Brennkammer; nur der Weltenbrecher hat
    Schnellfeuer gegen sie.“;
  * art: the Recycler of the interface v2 icon set
    (`docs/design/interface-v2/icons/ships/recycler.svg`), renamed in
    `<title>` and `aria-label`; the debris symbol `icons/debris.svg` is new
    (fragments of Adamant and Psikristall in the frame of the resource
    icons);
  * the messages „An dieser Position gibt es kein Trümmerfeld.“ and „Du
    brauchst eine Bergungsbarke.“ (like „keinen Planeten“ and the
    Kolonistenarche), the report title „Bergung erreicht [g:s:p]“ (like
    „Transport erreicht“), „kein Trümmerfeld“ beside the target of the
    fleet form;
  * the key `recycler`, the place in the Schiffsschmiede after the
    Kolonistenarche, and that the battle report names the debris of this
    battle, not the whole field.
* Tests: `src/core/debris.test.ts`, `src/core/battle.test.ts`,
  `catalog.test.ts`, `missions.test.ts`, the contract tests of the
  components and missions, `src/features/missions/harvest/harvest.test.ts`,
  `attack.test.ts`, `src/server/db/repos/debris.test.ts`,
  `upgrades/migration-16.test.ts`, `src/server/game/fleet.test.ts`,
  `admin.test.ts`, `src/client/logic/debris.test.ts`,
  `src/client/views/galaxy.test.ts`; `missions-reference.test.ts` leaves
  out what #45 adds to a battle and checks it on its own; E2E „a battle
  leaves a Trümmerfeld that every player sees; a Bergung takes it home“,
  the phone test of the Sternenkarte and axe on the Sternenkarte and the
  fleet form.

# Out of scope

* Moons and the moon chance (#53), debris of expeditions (positions 16/17),
  Pathfinder.
