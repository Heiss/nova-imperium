---
type: feature
title: Missiles
description: The missile silo, anti-ballistic missiles and interplanetary missiles against defense with their classic values; missiles are no longer a non-goal (issue #54).
---

# Missiles

Issue #54, part of the Classic features (#222). The owner's answers of
2026-11-16, checked against owiki.de the same day. Sources:

* „Raketensilo“ (https://owiki.de/index.php?title=Raketensilo&oldid=78597)
* „Abfangrakete“ (https://owiki.de/index.php?title=Abfangrakete&oldid=77815)
* „Interplanetarrakete“ (https://owiki.de/index.php?title=Interplanetarrakete&oldid=78711)
* „Changelog vor Redesign“ (https://owiki.de/index.php?title=Changelog_vor_Redesign&oldid=78869)

# Decisions

* **[E]** Missiles come: they are no longer a non-goal (owner, 2026-11-16,
  D1; [Overview](/overview.md)).
* **[E]** Missile silo (owner, 2026-11-16, Q1): 20,000 Adamant, 20,000
  Psikristall, 1,000 Promethium, factor 2; per level room for 5
  interplanetary or 10 anti-ballistic missiles, an interplanetary missile
  takes the room of two (owiki „Raketensilo“).
* **[E]** Anti-ballistic missile (owner, 2026-11-16, D2, checked on owiki
  as asked): 8,000 Adamant, 0 Psikristall, 2,000 Promethium (owiki
  „Abfangrakete“).
* **[E]** Interplanetary missile (owner, 2026-11-16, Q1): 12,500 Adamant,
  2,500 Psikristall, 10,000 Promethium, attack 12,000 (owiki
  „Interplanetarrakete“).
* **[E]** Range: (impulse drive level × 5) − 1 systems (owner, 2026-11-16,
  Q1). owiki dates this formula to v0.78c (17 January 2008).
* **[U]** The smaller range before v0.78c is not documented; it is not
  needed, as the owner took the formula above.
* **[E]** Flight time in seconds: (30 + 60 × systems) / universe speed
  (owner, 2026-11-16, Q1; owiki „Interplanetarrakete“).
* **[E]** Defense destroyed by missiles is not rebuilt (owner, 2026-11-16,
  Q1; owiki „Interplanetarrakete“).
* **[E]** The anti-ballistic missiles of a planet also protect its moon
  (owner, 2026-11-16, Q1; owiki „Raketensilo“, moons can be attacked by
  missiles since v0.78a).
* **[E]** Damage of interplanetary missiles: the main target first, then
  the order of the catalog (owner, 2026-11-16, D3).

# Proposals

The classic values on owiki that the owner's list did not name:

* **[V]** Silo requirement shipyard 1. Anti-ballistic missile: structure
  8,000, shield 1, attack 1; needs silo 2 and shipyard 1. Interplanetary
  missile: structure 15,000, shield 1; needs silo 4, shipyard 1 and impulse
  drive 1 (owiki).
* **[V]** One anti-ballistic missile stops exactly one interplanetary
  missile; missiles take no fleet slot and cannot be recalled; they
  cannot target a player in noob protection or in vacation mode; there is
  no silo on a moon (owiki).
* **[V]** Debris of defense destroyed by missiles does not go into the
  Trümmerfeld (owiki „Interplanetarrakete“, see
  [Trümmerfelder](/features/debris.md)).
* **[V]** Names from [Grimdark naming](/features/naming.md): Raketenkrypta
  (silo), Abfangrakete, Orbitalrakete.

# Built (first pull request)

Built on the branch `claude/missiles` (2026-11-17), within the decisions
above.

* **[E]** Catalog (patterns, sections 1 and 10): three feature folders,
  `silo` (Raketenkrypta, building, order 160, after the buildings of the
  moon; planets only, as every building without `placement`), `abm`
  (Abfangrakete, defense, order 90) and `ipm` (Orbitalrakete, defense,
  order 100), with the values above. Two new components with one rule
  module, `src/core/components/silo.ts`: `silo: { slots }` on a building
  (10 places per level) and `missile: { slots, intercepts? }` on a defense
  (1 and 2 places; the Abfangrakete intercepts). `catalog.ts` derives
  `SILO` and `MISSILE`; `FIGHTERS` leaves the missiles out, so they never
  take part in a battle (owiki „Abfangrakete“: the values have no meaning,
  it fights only Interplanetarraketen) and the Sturmangriff keeps them
  as they are, outside its battle report and the 70 % rebuild.
* **[E]** Room of the silo: `siloUse`, `siloRoom` and `unitRoom` in
  `src/core/yard.ts` count the stock and the shipyard queue; the order
  check `orderErrors` has the code `siloFull`; the largest order and
  „Bauen“ in Verteidigung follow it; the Raketenkrypta shows „Belegt: x /
  y Plätze“ (the frozen buildings view of the reference test has this one
  change, marked).
* **[E]** Missile rules in `src/core/missiles.ts`: `missileRange`,
  `inMissileRange` (the same galaxy, |s − s₀| systems, no wrap, as the
  Auspex-Phalanx), `missileFlightMs`, `launchError` (codes for the server
  and the Sternenkarte) and `strike` (intercept, then the damage from the
  main target on through the catalog order).
* **[E]** Flight as the mission `missile` (patterns, section 4): the
  folder `src/features/missions/missile/` with `rules.ts` (order 70, target
  `foreign`, no cargo, no return, visible to the defender, no guild alert),
  `texts.de.ts` („Raketenangriff“) and `arrive.server.ts` (the impact).
  `MissionRules` has the optional field `launch` (`'fleet'` by default,
  `'missiles'` for this mission, `launchOf()`): the fleet form offers only
  `FLEET_MISSIONS`, the action `send` refuses the mission („Unbekannter
  Auftrag.“), `isFleet()` keeps it out of the fleet slots (server and
  fleet view) and out of the recall (overview; server „Rückruf nicht mehr
  möglich.“). A Raketenangriff whose target is gone is lost, with a report.
* **[E]** Server action `missile` (`src/server/game/missiles.ts`):
  from the selected planet, `to` (coordinates and kind), `n` and `aim`;
  the missiles leave the planet's defense; the audit event `game` /
  `missile`, the impact `system` / `missile`. Missiles in flight count for
  the points until their impact (owiki).
* **[E]** Migration `20261117T1006-missiles` rebuilds `fleets` and
  `fleet_ships` for the mission `missile` and adds `fleets.aim` (TEXT, the
  main target, NULL without one); the fleet repository writes `aim` only
  for missiles with a main target, as it writes `gift` only for a gift.
* **[E]** Sternenkarte (HTML, `src/client/views/missiles.ts`,
  `src/client/logic/missiles.ts`): the button „Raketenangriff“ at a
  foreign planet or moon when the shown planet has Orbitalraketen and the
  target is in range; the dialog asks for „Anzahl“ and „Hauptziel“.
  `src/client/main.ts` spreads the two actions and did not grow.
* **[V]** Taken as recommended (owner's rule of 2026-11-15 in
  [Release loop](/ops/loop.md)), for the owner to confirm:
  * abbreviations `RK`, `AR`, `OR`; the Abfangrakete keeps its classic
    name, so the naming test no longer counts a kept name as classic;
    short texts „Lagert Raketen: pro Stufe 10 Abfangraketen oder 5
    Orbitalraketen.“, „Zerstört eine anfliegende Orbitalrakete.“,
    „Zerstört fremde Verteidigung aus der Ferne; Abfangraketen wehren sie
    ab.“ (after the classic in-game texts on owiki); long texts in the
    style of #94 (`texts.de.ts`); art: the three icons of the interface v2
    set, renamed in `<title>` and `aria-label`;
  * the mission name „Raketenangriff“ (the issue's text);
  * the messages „Nicht genug Platz in der Raketenkrypta.“, „Nicht genug
    Orbitalraketen.“, „Unbekanntes Hauptziel.“, „Das Ziel liegt außerhalb
    der Reichweite der Orbitalraketen.“, „x Orbitalraketen unterwegs nach
    [g:s:p].“; reused: „Bitte eine Anzahl eingeben.“, „An dieser Position
    gibt es keinen Planeten.“, „… keinen Mond.“, „Eigene Planeten kann man
    nicht angreifen.“, „Dieser Spieler steht unter Noobschutz.“,
    „Unbekannter Auftrag.“, „Rückruf nicht mehr möglich.“;
  * the reports: the issue's sentence with the new name, „x
    Orbitalraketen trafen [g:s:p]; y wurden abgefangen.“, followed by
    „Zerstört: 3 Massebeschleuniger, 7 Raketenbatterie.“ or „Keine
    Verteidigung zerstört.“; the title „Raketenangriff [g:s:p]“ for the
    attacker and the title of a battle, „Feindkontakt! <Name> [g:s:p] wird
    von <Spieler> angegriffen“, for the defender; a lost attack „An
    [g:s:p] wurde kein passendes Ziel gefunden. Deine Orbitalraketen sind
    verloren.“;
  * the dialog „Raketenangriff auf <Name> [g:s:p]“, „Anzahl“ (all
    Orbitalraketen of the planet preset), „Hauptziel“ with „Kein
    Hauptziel“ first, „Starten“, „Abbrechen“;
  * the damage: what is left after a kind goes on to the next kind of the
    order, also when the main target is not destroyed completely (the
    reading of D3); a piece falls only to its whole structure;
  * the main target and the hit defense are the defense that fights: the
    missiles themselves are never hit (owiki has them hit when no defense
    is left; not decided);
  * the places of the silo count the missiles in the shipyard queue too;
  * the defender sees the missiles coming in the overview.
* **[U]** Not built, open: tearing missiles down for free (issue, owiki
  „Raketensilo“); the demolition of the Raketenkrypta below the places its
  missiles take (#202 decides demolition); the check of the vacation mode
  (#223, below).
* **[V]** Vacation mode (#223, built in parallel): the target check takes
  the protection as one function, `protects(owner)` in `launchError`
  (`src/core/missiles.ts`), which the server passes from
  `src/server/game/missiles.ts` (today the noob protection; the comment
  „The vacation mode joins here with #223“ marks the place). TODO for #223:
  add the vacation mode to that one call, as for the fleets.
