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
* **[E]** Once no defense is left, the rest of the damage destroys the
  missiles stored in the target's Raketenkrypta, Abfangraketen and
  Orbitalraketen, in the order of the catalog (owner, 2026-11-17, classic;
  owiki „Interplanetarrakete“).
* **[E]** The defender sees incoming Orbitalraketen in the fleet movements
  under the same thresholds of the Auspex-Lehre as a foreign fleet (owner,
  2026-11-17, #228).
* **[E]** The German texts of the first pull request (below) are confirmed
  (owner, 2026-11-17). Tearing missiles down for free and the demolition of
  the Raketenkrypta stay open, with #202.

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
  `silo` (Raketenkrypta, building, order 180, after the buildings of the
  moon and the Handelsposten; planets only, as every building without `placement`), `abm`
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
  main target on through the catalog order; once no defense is left, the
  rest on through the stored missiles, without the Abfangraketen that
  intercepted when they stand on the target itself).
* **[E]** Flight as the mission `missile` (patterns, section 4): the
  folder `src/features/missions/missile/` with `rules.ts` (order 90: the Mondbruch has 70 and the Vermessung 80 in the bundle, each order once; target
  `foreign`, no cargo, no return, no guild alert),
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
* **[E]** Migration `20261118T2235-missiles` rebuilds `fleets` and
  `fleet_ships` for the mission `missile` and adds `fleets.aim` (TEXT, the
  main target, NULL without one); the fleet repository writes `aim` only
  for missiles with a main target, as it writes `gift` only for a gift.
* **[E]** Sternenkarte (HTML, `src/client/views/missiles.ts`,
  `src/client/logic/missiles.ts`): the button „Raketenangriff“ at a
  foreign planet or moon when the shown planet has Orbitalraketen and the
  target is in range; the dialog asks for „Anzahl“ and „Hauptziel“.
  `src/client/main.ts` spreads the two actions and did not grow.
* **[V]** Taken as recommended (owner's rule of 2026-11-15 in
  [Release loop](/ops/loop.md)); the German texts among them are confirmed
  (owner, 2026-11-17, [E] above), the two points marked „now [E]“ were
  decided by the owner:
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
  * the main target is a defense that fights; the stored missiles are hit
    only after the last defense (now [E], above);
  * the places of the silo count the missiles in the shipyard queue too;
  * the defender sees the missiles coming in the overview (now [E],
    above): built through `foreignView` of `src/server/game/state.ts`, the
    path of every foreign fleet. #228 is on `main` and the thresholds of
    the Auspex-Lehre (`src/core/fleet-recognition.ts`) apply to the
    flight like to a fleet: the missiles of the flight are its ships, so
    `seenShips()` gives their total number from the first threshold, their
    type from the second and the exact number from the third; the main
    target (`aim`) and the start never leave the server. The mission has no
    field `visible` any more (#228). Pinned in
    `src/server/game/fleet-recognition.test.ts` (every level, the round's
    thresholds, nothing hidden in the answer) and
    `src/client/logic/overview.test.ts`.
  * **[V]** The row of the overview words what is seen with the text of a
    fleet (coordinator, 2026-11-19, taken as recommended), so a flight
    shows „(Schiffe insgesamt: 3 · Orbitalrakete)“ or „(3 Orbitalrakete)“:
    „Schiffe“ for missiles. The owner decided only that the defender sees
    them „like a foreign fleet“. Open question for the owner [U]: keep this
    wording, or a wording of its own for missiles („Raketen insgesamt: 3“,
    options: 1. keep, 2. „Raketen insgesamt“ for the mission `missile`,
    3. a text of its own for the whole row, 4. no „Schiffe“ part).
* **[U]** Not built, open: tearing missiles down for free (issue, owiki
  „Raketensilo“) and the demolition of the Raketenkrypta below the places
  its missiles take, both with #202 (owner, 2026-11-17).
* **[V]** Vacation mode (#223, built into the bundle with #54): the check of
  the target asks it after the range and before the noob protection, as
  for a fleet (`vacationProtects`, `src/core/vacation.ts`): a place of a
  player in vacation mode is refused with the code `vacation` of
  `launchError` and „Dieser Spieler ist im Urlaubsmodus.“, the text of the
  fleets; nothing is spent. A player in vacation mode cannot launch: the
  action `missile` is not on the list of the lock screen. The server passes
  `vacation: inVacation(ctx)` beside `protects`.
* **[V]** Highscore (#78): missiles are no defense that fights, so they stay
  out of the category „Verteidigung“ and count in the total only (pinned in
  `src/features/missions/missile/missile.test.ts`).
* **[V]** Mondbruch (#95): missiles in flight to a moon that breaks are not
  rerouted to its planet like the fleets (`fleets.reroute` keeps the
  missions of `SILO_MISSIONS`); with their target gone they are lost at the
  arrival, as above. A missile that hit another place than the one aimed at
  would be a different attack.
* **[V]** Abandon (#224): the refusal says „Flotten“ for a missile in flight
  too (coordinator, 2026-11-18).
* **[V]** Lexicanum (#285): the articles of the Raketenkrypta, the
  Abfangrakete and the Orbitalrakete have keywords only, the mission
  Raketenangriff has a text of what happens on arrival, all as drafts in
  [Lexicanum texts](/features/lexicanum-texts.md); the Raketenkrypta has the
  order 180: the Warp-Tor (#230) has 160 and the Handelsposten (#171, on
  main) took 170 first, so the Raketenkrypta moved to the next free number
  (taken as recommended).
