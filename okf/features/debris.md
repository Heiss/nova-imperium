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

# Out of scope

* Moons and the moon chance (#53), debris of expeditions (positions 16/17),
  Pathfinder.
