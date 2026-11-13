---
type: feature
title: Moons with Mondzitadelle, Auspex-Phalanx and Warp-Tor
description: Moons from large debris fields after a battle, their own buildings Mondzitadelle (classic Mondbasis), Auspex-Phalanx (Sensorphalanx) and Warp-Tor (Sprungtor), built in three pull requests (issue #53).
---

# Moons

Issue #53, milestone `next release` (owner, 2026-11-13). Sources: owiki.de
„Mond“, „Mondbasis“, „Sensorphalanx“, „Sprungtor“ (read 2026-11-13) and the
issue. Needs debris fields (#45, [Trümmerfelder](/features/debris.md)), the
model of places (#119, O11) and fields (#51, [Planet fields](/features/fields.md)).

* **[E]** Moons are no longer a non-goal (owner, 2026-11-13).
* **[E]** Built in this release in three pull requests: moons with the
  Mondzitadelle, then the Auspex-Phalanx, then the Warp-Tor (owner,
  2026-11-13).
* **[E]** Moon chance after a battle at a planet: min(⌊debris / 100,000⌋,
  20) %, counted from the **whole** Trümmerfeld at the position after the
  battle (owner, 2026-11-13; owiki.de counts only the new debris of the
  battle). At most one moon per planet; it belongs to the planet's owner.
* **[E]** Diameter = ⌊√(x + 3 · chance) · 1000⌋ km, x a whole number from 10
  to 20, all equally likely (owiki.de „Mond“, Mondgröße): 3,605 to 8,944 km
  (owner, 2026-11-13). It decides the destruction chance of #95.
* **[E]** Fields: a moon starts with 1 field, every Mondzitadelle level adds
  3 and takes one itself, without an upper limit (owner, 2026-11-13; the
  diameter limit was removed in v0.77c).
* **[E]** A moon behaves like a planet: resources, fleets and defense, no
  production. Attack, transport, espionage and Verlegung fly to and from
  moons; colonization and Bergung never target a moon; noob protection is
  the one of the owner (owner, 2026-11-13). The distance planet ↔ moon is 5
  (`distance()` for the same coordinates).
* **[E]** Buildings on a moon: Servitorenschmiede, Orbitale Schiffsschmiede,
  the three stores, Mondzitadelle, Auspex-Phalanx, Warp-Tor; not the mines,
  Sonnenkathedrale, Fusionssanktum, Scholarium, Machina-Schwarmhalle,
  Weltenschmiede. Defense takes no field. Sonnenreliquiare give energy there
  as everywhere (owner, 2026-11-13).
* **[E]** Mondzitadelle (classic Mondbasis): 20,000 Adamant, 40,000
  Psikristall, 20,000 Promethium, factor 2; no requirement; +3 fields per
  level, takes one; cannot be torn down (owner, 2026-11-13).
* **[E]** Auspex-Phalanx (classic Sensorphalanx): 20,000 / 40,000 / 20,000,
  factor 2; needs Mondzitadelle 1; range level² − 1 systems; a scan costs
  5,000 Promethium on the moon and shows every flight to and from the
  scanned foreign planet (ships, origin, target, arrival, no cargo); moons
  cannot be scanned; the scanned player is not told (owner, 2026-11-13,
  the classic simple rule).
* **[E]** Warp-Tor (Sprungtor, modern levels): level 1 costs 2,000,000 /
  4,000,000 / 2,000,000, factor 2; needs Mondzitadelle 1 and Warp-Theorie 7;
  moves ships only (no resources) at once and without fuel to another own
  moon with a Warp-Tor; both gates then cool down by the level of the
  starting gate (owner, 2026-11-13): owiki.de values 1: 60, 2: 53, 3: 47,
  4: 41, 5: 36, 10: 17, 15 and more: 10 minutes; in between linear, rounded
  to whole minutes: 6: 32, 7: 28, 8: 25, 9: 21, 11: 16, 12: 14, 13: 13,
  14: 11.
* **[E]** Moons come from battles and from the admin: in the admin area, at
  a planet of a player without a moon, „Mond anlegen“ with a chance of 1 to
  20 %; the diameter follows the formula; audited (owner, 2026-11-13).
* **[E]** Display (owner, 2026-11-13, proposal A): a moon symbol at the
  planet in the Sternenkarte, visible to everyone, with a link; the moon is
  its own entry „<Planetenname> (Mond)“ in the planet list; the battle
  report shows „Mondchance: x %“ and, when a moon forms, „Die enormen Mengen
  an freiem Adamant und Psikristall ziehen sich an und formen einen
  Trabanten um den Planeten.“
* **[E]** Names in the grimdark style of #127: Mondzitadelle, Auspex-Phalanx,
  Warp-Tor (owner, 2026-11-13).
* **[V]** Short and long texts, abbreviations and art of the three buildings
  and of the moon are proposed in the pull requests.

# Out of scope

* Moon destruction (#95), Abfangraketen (#54), giving up or tearing down a
  moon.
