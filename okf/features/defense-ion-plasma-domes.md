---
type: feature
title: Ionengeschütz, Plasmawerfer and shield domes
description: The defense of issue #50, its values, the one-per-planet rule of the domes and what waits for the Bomber.
---

# Ionengeschütz, Plasmawerfer and shield domes

Issue #50, milestone `next release` with #46, #47 and #49 (owner, 2026-11-12).
Not in version 1. Missiles are #54.

* **[E]** Ionengeschütz: structure 8,000 (hull 800), shield 500, attack 150.
  Requires Werft 4 and Ionentechnik 4 (#49) (owner, 2026-11-12).
* **[U]** Cost of the Ionengeschütz: 5,000 metal, 3,000 crystal, 0
  deuterium, the wiki value. The owner's comparison has no value; the owner
  checks the classic value later, a change is its own pull request (D1 = 1,
  owner, 2026-11-12).
* **[E]** Plasmawerfer: 50,000 metal, 50,000 crystal, 30,000 deuterium;
  structure 100,000 (hull 10,000), shield 300, attack 3,000. Requires Werft 8
  and Plasmatechnik 7 (#49) (owner, 2026-11-12).
* **[E]** Kleine Schildkuppel: 10,000 metal, 10,000 crystal; structure 20,000
  (hull 2,000), shield 2,000, attack 1. Requires Werft 1 and
  Schildtechnik 2 (owner, 2026-11-12).
* **[E]** Große Schildkuppel: 50,000 metal, 50,000 crystal; structure
  100,000 (hull 10,000), shield 10,000, attack 1. Requires Werft 6 and
  Schildtechnik 6 (owner, 2026-11-12).
* **[E]** Each dome at most once per planet; a second order of the same dome
  is refused with a German message. A destroyed dome is rebuilt after the
  battle like any defense (`rebuild()`, `src/server/game/arrival.ts`)
  (D3 = 1, owner, 2026-11-12).
* **[E]** Rapid fire only for units that exist. The Bomber's rapid fire
  against the Plasmawerfer and the Ionengeschütz is decided with #57, the
  Todesstern's with #60 (D2, owner, 2026-11-12). No unit has rapid fire
  against the domes.
* **[U]** The values are from the wiki (sources in #50); the owner took them
  over unchanged.
* **[V]** German interface: Verteidigung gets four entries with new art; the
  domes show „max. 1“.
