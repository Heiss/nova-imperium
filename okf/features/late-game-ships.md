---
type: feature
title: Schlachtkreuzer, Zerstörer and Bomber
description: The three combat ships of issues #57, #58 and #59, their classic values from owiki.de, rapid fire and the drive switch of the Bomber.
---

# Schlachtkreuzer, Zerstörer and Bomber

Issues #58, #59 and #57 (parent #56), milestone `next release` (owner,
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
* **[E]** A rapid fire value against a unit is added when both units exist;
  the Todesstern's values come with #60.
* **[V]** German interface: Werft gets three entries; the icons exist
  (`battlecruiser.svg`, `destroyer.svg`, `bomber.svg` in the interface v2
  set). The Bomber shows its current drive.
* Sources: owiki.de pages Schlachtkreuzer, Zerstörer, Bomber,
  Hyperraumantrieb (read 2026-11-12).
