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

# Code, interface and tests

* Catalog: `DEF.ionc` (Ionengeschütz), `DEF.pt` (Plasmawerfer), `DEF.ssd`
  (Kleine Schildkuppel) and `DEF.lsd` (Große Schildkuppel) in
  `src/shared/catalog.ts`, after the Gaußkanone. Hull, shield and attack come
  from `buildSide()` in `src/shared/battle.ts` (hull 800, 10,000, 2,000 and
  10,000 before Raumschiffpanzerung); bounce below 1 % of the shield and the
  explosion below 70 % hull are unchanged. Only the Bomber has rapid fire
  against them: `SHIPS.bb.rf.ionc` 10; otherwise `rapid()` gives 1 both ways.
* Once per planet: the domes carry `once: true` (`DefenseDef`).
  `unitRoom()` in `src/shared/yard.ts` counts the planet's dome and the units
  of it in the shipyard queue; `orderMax()` is the smaller of that room and
  what the planet can pay. The action `order` (`src/server/game/actions.ts`)
  refuses an order larger than the room before it looks at the resources, so
  an order of two domes is refused even when only one can be paid.
  `afterBattle()` and `rebuild()` (`src/server/game/arrival.ts`) are
  unchanged: a destroyed dome is rebuilt with the same 70 % chance.
* Interface: the defense view shows „(vorhanden: N · max. 1)“ for a dome; the
  „(max N)“ link and the order button use `orderMax()`, so a planet with its
  dome built or queued sees „(max 0)“ and a disabled button; the number field
  has `max="1"`.
* Points: the cost counts like for every unit (`src/server/game/points.ts`);
  achievements per defense come automatically (`src/shared/achievements.ts`).
* **[V]** Keys `ionc`, `pt`, `ssd`, `lsd` (the research keys `ion` and
  `plasma` are taken); abbreviations `IG`, `PW`, `KSK`, `GSK` (unique among
  all `ab` values; `KS` and `GK` are taken).
* **[V]** Descriptions (`ds`, shown with a (?) by #63): „Geschütz mit starkem
  Schild, das viele Treffer einsteckt.“, „Die stärkste Waffe der
  Verteidigung: feuert Plasma mit gewaltiger Wucht.“, „Kuppel mit starkem
  Schild über dem Planeten; schwache Schüsse prallen ab. Nur eine pro
  Planet.“, „Die größere Kuppel mit fünffachem Schild; nur starke Schüsse
  dringen durch. Nur eine pro Planet.“
* **[V]** Message of a refused dome: „Diese Schildkuppel gibt es nur einmal
  pro Planet.“; the field `once` and the helpers `unitRoom()`/`orderMax()`.
* Icons `ion_cannon.svg`, `plasma_turret.svg`, `small_shield_dome.svg` and
  `large_shield_dome.svg` from the interface v2 set in
  `src/client/static/icons/defense/`, mapped in `src/client/logic/icons.ts`.
* Tests: `src/shared/catalog.test.ts` (values, version 1 equivalence with the
  new keys added like `colony`, unique abbreviations), `economy.test.ts`
  (`reqMissing`), `battle.test.ts` (hull, tech bonus, no rapid fire, bounce,
  explosion, two battles), `yard.test.ts` (`unitRoom`, `orderMax`),
  `src/server/game/actions.test.ts` (existing dome, queued dome, order of
  two, order of the checks), `admin.test.ts` (points),
  `src/client/logic/icons.test.ts`; E2E „Ionengeschütz, Plasmawerfer and the
  shield domes; a dome only once (#50)“ and its phone variant in
  `e2e/game.spec.ts`.
