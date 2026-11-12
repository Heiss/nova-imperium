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
* **[E]** Build order: Schlachtkreuzer → Zerstörer → Bomber → Todesstern,
  each after its prerequisites (#56 D2, owner, 2026-11-12).
* **[V]** German interface: Werft gets three entries; the icons exist
  (`battlecruiser.svg`, `destroyer.svg`, `bomber.svg` in the interface v2
  set). The Bomber shows its current drive.
* Sources: owiki.de pages Schlachtkreuzer, Zerstörer, Bomber, Todesstern,
  Hyperraumantrieb (read 2026-11-12).

# Schlachtkreuzer and Zerstörer in the code

* Catalog: `SHIPS.bc` (Schlachtkreuzer) and `SHIPS.dr` (Zerstörer) in
  `src/shared/catalog.ts`, between the Schlachtschiff and the Spionagesonde.
  Both fly with `drive: 'hdrive'`; `shipSpeed()` in `src/shared/flight.ts`
  adds 30 % per Hyperraumantrieb level. Hull, shield and attack come from
  `buildSide()` in `src/shared/battle.ts` (hull 7,000 and 11,000 before
  Raumschiffpanzerung); the shipyard shows the structure (M + K).
* Rapid fire in `rf`: `bc` against `sc` 3, `lc` 3, `hf` 4, `cr` 4, `bs` 7;
  `dr` against `ll` 10, `bc` 2. The 5 against the probe is the general rule
  of `rapid()` and is not repeated in the catalog. The Solarsatellit gets
  its 5 by the general rule of #96; the Todesstern values follow with #60.
* Points: the cost counts like for every unit (`src/server/game/points.ts`);
  achievements per ship come automatically (`src/shared/achievements.ts`).
* **[V]** Keys `bc` and `dr`; abbreviations `SK` and `ZE` (unique among all
  `ab` values); descriptions „Schnell und stark gegen Transporter, Kreuzer
  und Schlachtschiffe.“ and „Schweres Kriegsschiff – stark gegen
  Lasergeschütze und Schlachtkreuzer.“ (the first ships with a `ds`).
* Icons `battlecruiser.svg` and `destroyer.svg` from the interface v2 set in
  `src/client/static/icons/ships/`, mapped in `src/client/logic/icons.ts`.
* Tests: `src/shared/catalog.test.ts` (values, version 1 equivalence with the
  new keys added like `colony`), `battle.test.ts` (hull, tech bonus, rapid
  fire both ways), `flight.test.ts` (speed, fuel, cargo), `economy.test.ts`
  (`reqMissing`), `src/server/game/admin.test.ts` (points),
  `src/client/logic/icons.test.ts`; E2E „Schlachtkreuzer and Zerstörer are
  built and fly (#58, #59)“ and its phone variant in `e2e/game.spec.ts`.

# Bomber in the code

* Catalog: `SHIPS.bb` (Bomber) in `src/shared/catalog.ts`, after the
  Zerstörer. Base drive `impulse` with speed 4,000; `drives` lists the
  switch `{ drive: 'hdrive', speed: 5,000, from: { research: 'hdrive',
  level: 8 } }`. Requires Werft 8, Impulstriebwerk 6, Plasmatechnik 5.
* Drive: `activeDrive()` in `src/shared/flight.ts` returns the base drive or
  the last entry of `drives` whose research level is reached; `shipSpeed()`,
  and with it `fleetSpeed()`, flight time and the fleet view, use it. Ships
  without `drives` keep their single drive, so the version 1 equivalence is
  unchanged. Fuel stays 1,000 with both drives (`fuelFor()` does not depend
  on the drive).
* Rapid fire in `rf`: `bb` against `rl` 20, `ll` 20, `hl` 10; none against
  `gauss`. The 5 against the probe and the Solarsatellit come from the
  general rule of `rapid()`. The 10 against the Ionengeschütz follows when
  the Ionengeschütz (#50) is on `main` (#60 D4); the Todesstern's 25 against
  the Bomber comes with #60.
* Hull 7,500, shield 500, attack 1,000 from `buildSide()`; points by cost
  (`src/server/game/points.ts`).
* **[V]** Key `bb`, abbreviation `BO` (unique among all `ab` values),
  description „Stark gegen Raketenwerfer und Lasergeschütze; fliegt ab
  Hyperraumantrieb 8 mit dem Hyperraumantrieb.“
* **[V]** Data model of the drive switch: the base `drive` and `speed` stay,
  an optional `drives` list of `{ drive, speed, from: { research, level } }`
  replaces them once reached; the last reached entry wins. Built before the
  migration of the [Design patterns](/architecture/patterns.md); `activeDrive()`
  is the function `drive: (research) => DriveKey` of `mobile` there.
* **[V]** The Werft shows the speed with the active drive in brackets, e.g.
  „Tempo 8.800 (Impulstriebwerk)“, only for ships with a drive switch; the
  fleet view shows the current speed.
* Icon `bomber.svg` from the interface v2 set in
  `src/client/static/icons/ships/`, mapped in `src/client/logic/icons.ts`.
* Tests: `src/shared/catalog.test.ts` (values, order, version 1 equivalence
  with `bb` added), `battle.test.ts` (hull, tech bonus, rapid fire both ways,
  none against the Gaußkanone), `flight.test.ts` (speed below and from
  Hyperraumantrieb 8, mixed fleets, fuel, cargo), `economy.test.ts`
  (`reqMissing`), `src/server/game/admin.test.ts` (points); E2E „the Bomber
  is built, switches its drive at Hyperraumantrieb 8 and flies (#57)“ and
  its phone variant in `e2e/game.spec.ts`.
