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
* **[E]** Cost of the Ionengeschütz: 2,000 metal, 6,000 crystal, 0
  deuterium, the original cost on owiki.de (changed to 5,000 / 3,000 only
  with version 7.0.0) (D1, owner, 2026-11-12).
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
* **[E]** Rapid fire only for units that exist. Bomber (#57, classic):
  10 against the Ionengeschütz, none against the Plasmawerfer; the
  Todesstern's comes with #60 (D2, owner, 2026-11-12). No unit has rapid fire
  against the domes.
* **[U]** The other values are from the wiki (sources in #50) and match
  owiki.de; the owner took them over unchanged.
* **[V]** German interface: Verteidigung gets four entries with new art; the
  domes show „max. 1“.
