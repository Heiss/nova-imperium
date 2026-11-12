---
type: feature
title: Schlachtkreuzer, Zerstörer, Bomber and Todesstern
description: The combat ships of the epic #56 (issues #57 to #60), their classic values from owiki.de, rapid fire and the drive switch of the Bomber.
---

# Schlachtkreuzer, Zerstörer, Bomber and Todesstern

Epic #56 with #58, #59, #57 and #60, milestone `next release` (owner,
2026-11-12). „More ships“ is no longer a non-goal ([Overview](/overview.md)).
All values are the classic ones on owiki.de, confirmed by the owner
(2026-11-12). Hull in the engine = (metal + crystal) / 10.

* **[E]** Schlachtkreuzer (#58): 30,000 metal, 40,000 crystal, 15,000
  deuterium; structure 70,000 (hull 7,000), shield 400, attack 700; cargo
  750; speed 10,000 with the Hyperraumantrieb (+30 % per level); fuel 250.
  Requires Werft 8, Lasertechnik 12, Hyperraumtechnik 5, Hyperraumantrieb 5.
  Introduced with v0.75, before 1.0.
* **[E]** Zerstörer (#59): 60,000 metal, 50,000 crystal, 15,000 deuterium;
  structure 110,000 (hull 11,000), shield 500, attack 2,000; cargo 2,000;
  speed 5,000 with the Hyperraumantrieb; fuel 1,000. Requires Werft 9,
  Hyperraumantrieb 6, Hyperraumtechnik 5.
* **[E]** Bomber (#57), classic before the update of 2019-12-13: 50,000
  metal, 25,000 crystal, 15,000 deuterium; structure 75,000 (hull 7,500),
  shield 500, attack 1,000; cargo 500; fuel 1,000. Requires Werft 8,
  Impulstriebwerk 6, Plasmatechnik 5 (#49).
* **[E]** Drive switch of the Bomber (since v0.69c, before 1.0): below
  Hyperraumantrieb 8 it flies with the Impulstriebwerk, base speed 4,000,
  +20 % per Impulstriebwerk level; from Hyperraumantrieb 8 with the
  Hyperraumantrieb, base speed 5,000, +30 % per Hyperraumantrieb level. The
  drive becomes a function of the player's research (`ShipDef.drive`,
  `shipSpeed()` in `src/shared/flight.ts`).
* **[E]** Rapid fire, classic:
  - Schlachtkreuzer against Kleiner Transporter 3, Großer Transporter 3,
    Schwerer Jäger 4, Kreuzer 4, Schlachtschiff 7, Spionagesonde 5,
    Solarsatellit 5 (not 44 against the probe, a typo of the other wiki);
  - Zerstörer against Spionagesonde 5, Solarsatellit 5, Leichtes
    Lasergeschütz 10, Schlachtkreuzer 2;
  - Bomber against Spionagesonde 5, Solarsatellit 5, Raketenwerfer 20,
    Leichtes Lasergeschütz 20, Schweres Lasergeschütz 10, Ionengeschütz 10;
    **none** against the Gaußkanone and the Plasmawerfer (added only in 2019).
* **[E]** Todesstern (#60): 5,000,000 metal, 4,000,000 crystal, 1,000,000
  deuterium; structure 9,000,000 (hull 900,000), shield 50,000, attack
  200,000; cargo 1,000,000; speed 100 with the Hyperraumantrieb; fuel 1.
  Requires Werft 12, Hyperraumtechnik 6, Hyperraumantrieb 7,
  Gravitonforschung 1 (#49). Key `dstar`, abbreviation `TS` (D5). Classic
  numbers unchanged; the Nanitenfabrik shortens the build time (D6) (owner,
  2026-11-12).
* **[E]** Todesstern rapid fire: Spionagesonde 1,250, Solarsatellit 1,250,
  Kolonialschiff 250, Kleiner and Großer Transporter 250, Leichter Jäger 200,
  Schwerer Jäger 100, Kreuzer 33, Schlachtschiff 30, Bomber 25,
  Schlachtkreuzer 15, Zerstörer 5, Raketenwerfer 200, Leichtes
  Lasergeschütz 200, Schweres Lasergeschütz 100, Ionengeschütz 100,
  Gaußkanone 50. No unit has rapid fire against it.
* **[E]** Scope of #60: the ship now; the mission „Zerstören“ (moon
  destruction) comes later with the moons (#53) in its own issue. „Moons“
  stays a non-goal for now (D1, D3, owner, 2026-11-12).
* **[E]** A rapid fire value against a unit is added when both units exist
  (#60 D4).
* **[V]** German interface: Werft gets three entries; the icons exist
  (`battlecruiser.svg`, `destroyer.svg`, `bomber.svg` in the interface v2
  set). The Bomber shows its current drive.
* Sources: owiki.de pages Schlachtkreuzer, Zerstörer, Bomber, Todesstern,
  Hyperraumantrieb (read 2026-11-12).
