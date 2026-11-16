---
type: feature
title: Expeditions and position 16
description: The mission „Expedition“ to position 16 of a system with the classic Expeditionstechnik, its outcomes, slots and holding time, and debris from its battles (issue #93).
---

# Expeditions and position 16

Issue #93, part of the Classic features (#222). The owner's answers of
2026-11-16 to Q1 to Q5, checked against owiki.de the same day. Sources:

* „Expeditionstechnik“ (https://owiki.de/index.php?title=Expeditionstechnik&oldid=78794)
* „Expedition“ (https://owiki.de/index.php?title=Expedition&oldid=79024)
  and its discussion page with the old version of the article
  (https://owiki.de/index.php?title=Diskussion:Expedition&oldid=77157)
* „Changelog Redesign“ (https://owiki.de/index.php?title=Changelog_Redesign&oldid=79011)

Expeditions came with v0.78 on 20 November 2007.

# Decisions

* **[E]** Research (owner, 2026-11-16, Q1, classic values verified): the
  classic Expeditionstechnik, not Astrophysik. 4,000 Adamant, 8,000
  Psikristall, 4,000 Promethium, factor 2; needs Forschungslabor 3,
  Spionagetechnik 4 and Impulstriebwerk 3 (owiki „Expeditionstechnik“).
* **[E]** Slots and holding time (owner, 2026-11-16, Q3): the classic
  values are the default, and the admin can change them per round (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
  Verified: ⌊√level⌋ expeditions at the same time; at most as many hours at
  position 16 as the level of the technology (owiki „Expeditionstechnik“).
* **[E]** Position 16 (owner, 2026-11-16, Q4): classic, one position 16 per
  system that cannot be colonized, only the target of expeditions, visible
  in the Sternenkarte.
* **[E]** Outcomes (owner, 2026-11-16, Q2): the classic outcomes of v0.78
  by the source, without Dunkle Materie. The old article names, besides
  „nothing happens“, the finds of resources, of ship wrecks and of Dunkle
  Materie and the Händler, and the change of the return time, pirates,
  aliens and the loss of the fleet; every event but the Händler and the
  loss comes as normal, rare or exceptional (owiki „Diskussion:Expedition“).
* **[E]** Probabilities (owner, 2026-11-16, Q2): the owiki values from
  version 1.4.1 on are the basis, as owiki has none for classic: about
  84 % of the expeditions bring an event, and the size of a find is
  normal 89 %, large 10 %, very large 1 % (owiki „Expedition“).
* **[E]** Debris (owner, 2026-11-16, Q5): battles of an expedition leave a
  Trümmerfeld at position 16 (see [Trümmerfelder](/features/debris.md)).
  A deliberate deviation from classic: there these battles never left
  debris („Diese Kämpfe hinterlassen aber nie ein Trümmerfeld.“, owiki
  „Expedition“); debris on expeditions came only with version 7.0.0 in
  2019 (owiki „Changelog Redesign“).

# Open for the build

* **[V]** The resource type of a find in the ratio Adamant : Psikristall :
  Promethium = 3 : 2 : 1, the owiki value of version 1.4.1 on, which the
  owner took as the basis.
* **[E]** The chances follow the values of v1.4.1, the earliest with a
  source: an event in 84 % of the expeditions, sizes of a find 89 / 10 /
  1 % (owiki „Expedition“); no classic source before 1.0 could be read
  (owner, 2026-11-16).
* **[E]** The trader event is left out until a market exists; it may come
  with #171 (owner, 2026-11-16).
* **[U]** The change of the return time had no effect in classic (a bug,
  owiki „Diskussion:Expedition“); whether it really changes the return in
  Nova is not decided.
* **[U]** The size of the finds (classic resource and fleet finds, from
  v0.83 by the points of rank 1) is not decided.
* **[U]** Whether an expedition also takes a normal fleet slot (classic:
  yes, owiki „Expedition“) is not decided.
* **[E]** The expedition target is the position right after the last
  planet position of the universe: 16 with 15 positions, 21 with 20
  (owner, 2026-11-16; the admin sets 12 to 20 positions per system,
  [Admin](/features/admin.md)). „Position 16“ in this concept means that
  position.
* **[V]** Name of the research from [Grimdark naming](/features/naming.md):
  Kreuzzugs-Kartografie.
