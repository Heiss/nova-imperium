---
type: feature
title: Holding, alliance depot and attack unions
description: Holding fleets at another player's planet, the alliance depot that supplies them later, and attacks by a union of several players (ACS), with who may join set by the admin per round (issues #55, #225 and #227).
---

# Holding, alliance depot and attack unions

Issues #55 (holding and alliance depot), #225 (attack union, classic ACS
„Allianzkampfsystem“) and the combat part of #227 (friends), part of the
Classic features (#222). The owner's answers of 2026-11-16, checked against
owiki.de the same day. Sources:

* „Allianzkampfsystem“ (https://owiki.de/index.php?title=Allianzkampfsystem&oldid=71279)
* „Treibstoff“ (https://owiki.de/index.php?title=Treibstoff&oldid=78802)
* „Allianzdepot“ (https://owiki.de/index.php?title=Allianzdepot&oldid=78727)
* „Rückruf“ (https://owiki.de/index.php?title=R%C3%BCckruf&oldid=69695)

The battle with several parties is built with #55
([Design patterns](/architecture/patterns.md)).

# Who may fight together

* **[E]** The admin sets per round who may hold at a player and who may
  join an attack union: guild members, friends, or both (owner,
  2026-11-16, #55 Q2, #225 D2, #227 D3; friends are
  [Buddy list](/features/buddy-list.md); see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[V]** Default: guild and friends, the classic rule for holding
  („alliance members or buddies“, owiki „Allianzkampfsystem“). While
  guilds are off for a round ([Guilds on or off per round](/features/guild-switch.md)),
  only friends can count.

# Holding (#55)

* **[E]** Holding comes first, the alliance depot later (owner,
  2026-11-16, D1).
* **[E]** Fuel while holding (owner, 2026-11-16, D2, classic value
  verified): max(⌊Σ ships × base consumption × hours / 10⌋, 1) Promethium,
  a tenth of the normal consumption per ship and hour, paid at the launch
  with the flight fuel (owiki „Treibstoff“ and „Allianzkampfsystem“).
* **[E]** Holding times 0, 1, 2, 4, 8, 16 or 32 hours; at most four
  different players and 15 fleets per planet, besides the owner's own
  fleet (owner, 2026-11-16, classic values verified, owiki
  „Allianzkampfsystem“).
* **[E]** Loot (owner, 2026-11-16, D3): the cargo of held fleets can be
  plundered too. This is a Nova rule: no classic source documents it;
  classic loot is 50 % of the planet's stock (owiki „Beute“), and owiki
  contradicts itself on whether held fleets keep their cargo.
* **[U]** How the cargo of held fleets enters the loot (its share and the
  order against the planet's stock) is not decided.
* **[V]** No holding at a player in vacation mode or in noob protection,
  as in classic (owiki „Allianzkampfsystem“; see
  [Vacation mode](/features/vacation-mode.md)).
* **[E]** Loot (owner, 2026-11-17, completing the [U] above): when a
  planet with held fleets is raided, the loot takes the classic 50 % of
  the planet's stock first, then the cargo of the held fleets with the
  capacity that is left.
* **[E]** Who may hold is a value per round, set in the dialog „Neue
  Runde“ and editable in the admin panel during the round (owner,
  2026-11-17, X1).

* **[E]** The mission is called „Wache stellen“ in the game (owner,
  2026-11-17, not „Halten“ or „Wacht halten“); the refusals follow it.
* **[E]** Espionage report (owner, 2026-11-17): below a new value per round
  „Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“ (default 2; X1:
  in „Neue Runde“ and editable live), the held fleets appear only as
  defenders, mixed into the planet's fleet; from that level of the spy's
  Auspex-Lehre on, they appear apart under „Gehaltene Flotten“.
* **[E]** Auspex-Phalanx (owner, 2026-11-17): a held fleet shows as holding
  („hält bei [g:s:p]“ with the end of the holding time), not as its return
  flight.
* **[E]** Battles (owner, 2026-11-19, #55, „drei Ergänzungen“ 1): held fleets
  defend in all three fights: the Sturmangriff, the Mondbruch and the fight
  of detected Auspex probes. Missiles do not fight.
* **[E]** Vacation (owner, 2026-11-19, #55 / #223, 2): when the host starts
  the vacation mode, the fleets that hold at his planets and moons fly home
  at once. Unchanged: whoever holds with a fleet of his own cannot start
  the vacation while it is out.
* **[E]** Mondbruch (owner, 2026-11-19, #55 / #95, 3): a fleet that holds at
  a moon moves to the moon's planet when the moon breaks and holds there
  on.

## Built with #55

* The mission is `hold` (`src/features/missions/hold/`), named „Wache
  stellen“ (owner, 2026-11-17, [Naming](/features/naming.md));
  the issue's „Haltezeit“ and „Gehaltene Flotten“ stay. Order 70, the new
  target kind `ally` (a foreign planet whose owner is an ally, which the
  mission's `canSend` asks), cargo, return, ships not shown while it flies
  there (as a transport), no guild alert, and the new typed field `holds`
  of every mission's rules (patterns, section 4).
* The rules live in `src/core/holding.ts` (holding times, limits, who is
  an ally, when a fleet is due); the fuel `holdFuel` in
  `src/core/flight.ts`; the server part in `src/server/game/holding.ts`.
* The admin's setting is `roundAllies`, „Halten erlaubt für“ with the
  choices „Gilde“, „Freunde“ and „Gilde und Freunde“ [V] (1, 2, 3;
  default 3): the first entry of `roundSettings` in `src/core/holding.ts`,
  the registry of the round settings (#283, #310: the feature registers its
  settings itself, [Admin](/features/admin.md#the-registry-of-the-round-settings-283)),
  with the order number 100 and `live` (X1). So the dialog „Neue Runde“ offers the choice, kept without a
  choice like the lock of the main planet, and the universe settings
  show the same selection during the round.
  A guild member counts only while guilds are on in the round
  ([Guilds on or off per round](/features/guild-switch.md)). Friends
  count from an accepted friendship of the buddy list (#227, merged
  2026-11-19): `areFriends` in `src/server/game/holding.ts` asks
  `relationOf` of `src/core/friends.ts` for „friends“; an open request in
  either direction and an ended friendship are none.
* The vacation mode (#223) protects a target of every mission in its own
  check of the target kind, so it covers holding once it is merged; what it
  does to fleets that already hold or are on their way is in „The three
  decisions of 2026-11-19“ below.
* **[V]** Taken as recommended when building #55:
  * The holding time runs in real time, not divided by the speed of the
    universe, like the vacation and the main planet lock.
  * A fleet holds from its arrival for the chosen time and then flies
    home; its return time is set at the launch (flight, holding, flight).
    At 0 hours it turns home at the next beat of the clock.
  * The limits count the fleets that hold and those on their way to hold.
  * A fleet can be called back while it holds; it is home after the time
    of its flight there. The fuel of the unused hours is not refunded (no
    source names a refund).
  * The arrival writes no report; the owner sees the fleet in the fleet
    movements („hält bei“), the host under „Gehaltene Flotten“ in the
    overview with the owner, the origin, the ships and the time left.
  * **[E]** Seen by the host (owner, 2026-11-19, #55; the ships of #228):
    a fleet that **is holding** at the host's planet (state `hold`) shows to
    the host in full: every ship with its exact number and the holding time,
    whatever his Auspex-Lehre and whatever the thresholds of the round are.
    The Auspex-Lehre and the thresholds of #228 count only while the fleet is
    still **on its way** to hold (state `out`): then it goes through
    `foreignView` like any foreign fleet flying to the planet, and the host
    sees of its ships only what his level recognizes (below the first
    threshold „Zusammensetzung unbekannt“). The condition sits in
    `foreignView` of `src/server/game/state.ts`. A third player sees no
    fleet of the planet in his state; he sees a held fleet only in the
    Auspex-Phalanx (owner, 2026-11-17) and, as a defender, in a spy report
    (below).
  * Every fleet that holds is a party of its own in the battle
    (`battleOf` of `src/core/battle.ts`), in all three fights (owner,
    2026-11-19, see „The three decisions of 2026-11-19“ below); each of its
    owners gets the report of the defender once, with each fleet as
    „Verteidiger <name>“ and its losses; a fleet without survivors is gone.
    A fleet of the attacker himself that holds there stays out of the
    battle.
  * The cargo of the held fleets is taken whole (not half) with the room
    left; the rest is lost with the fleets, which are destroyed when the
    attacker wins. 1 hour is preselected in the form.
  * „alles“ of the fleet form (#240) leaves the fuel of the holding time
    on the planet too, as the flight fuel.
  * The spy report (`withHeldFleets` in `src/server/game/holding.ts`, one
    call of the arrival of the Auspex-Erkundung): the setting is
    `roundHeldSpy`, range 0 to 30 [V], the second entry of `roundSettings`
    in `src/core/holding.ts` (#283, #310), order number 110, and `live` (X1): a
    number field in „Neue Runde“ and a row of the universe settings; the
    held fleets follow the section „Flotte“ and show
    only when it shows (score 2), apart as „Gehaltene Flotten“ with
    „<name>: <ships>“ per fleet; the chance of the Auspex-Abwehr still
    counts the planet's own ships only. The label says „Auspex-Bericht“
    (owner, 2026-11-18, recorded on #55 on 2026-11-19), the name of #94, so the naming test needs no
    exception. A wrong value in „Neue Runde“ is refused with
    „Bitte für „<label>“ eine ganze Zahl von 0 bis 30 angeben.“ [V]; in
    the universe settings a wrong value of either setting gets the
    wording of the other settings there.
  * The phalanx shows a held fleet with its origin, „hält bei <target>“
    and the countdown to the end of its holding time (`holds` of
    `ScannedFlight`).
  * The refusals: „Wache stellen nur bei Gildenmitgliedern und Freunden.“
    (by the setting „… nur bei Gildenmitgliedern.“ or „… nur bei
    Freunden.“), „An diesem Planeten halten bereits 15 Flotten.“, „An
    diesem Planeten halten bereits Flotten von 4 Spielern.“, „Bitte eine
    Haltezeit auswählen.“ and „Bitte auswählen, wer in der neuen Runde
    halten darf.“; a holding planet of a player in noob protection keeps
    „Dieser Spieler steht unter Noobschutz.“.

# The three decisions of 2026-11-19 (#55)

Built on `claude/hold-decisions`; the owner's comment „drei Ergänzungen“ on
#55 (see above).

## Held fleets defend in all three fights

* **[E]** The Sturmangriff, the Mondbruch and the fight of detected Auspex
  probes each ask `defenders(ctx, f, t)` of `src/server/game/fight.ts` and
  pass the result to the one shared battle (`raid` for the first two,
  `fight` for the probes): one party per held fleet, its losses, its share
  of the debris (30 % of what every party lost lies at the position), the
  report of the defender for the owner of every held fleet, once, with the
  title and the push kind of the defender („attacked“, in the probes'
  fight „spied“). Reports and loot of the Sturmangriff are as before. The
  Mondbruch plunders like a Sturmangriff, so the held cargo is taken after
  the moon's stock when the attacker wins; the fleets that held are then
  destroyed (a won battle leaves no defender). The probes do not plunder.
  Missiles do not fight and stay as they were.
* **[V]** A detected spying at a planet with neither ships nor defense, but
  with a fleet that holds there, fights that fleet (the rule of
  2026-11-17, „a target with neither gives no battle“, counts the held
  fleets as ships). The chance of the Auspex-Abwehr still counts the
  planet's own ships only (owner, 2026-11-17), and the Auspex-Bericht shows
  the held fleets as they were before the battle.
* A fleet of the attacker himself that holds at the target stays out in the
  Mondbruch and the fight of the probes too.
* The Lexicanum draft of the mission says the fleet „verteidigt den Planeten
  in jedem Kampf“ ([Lexicanum texts](/features/lexicanum-texts.md)); that is
  true now, so no Lexicanum text changed. The article of the Mondbruch says
  nothing about held fleets.
* Consequence of 1 together with 3 (seen when building): the Mondbruch
  rolls only after a **won** battle, and a won battle leaves no defender.
  A foreign fleet that holds at the moon therefore fights and is destroyed
  whenever the moon can break; the fleet that moves with the broken moon is
  one that took no part in the battle: the attacker's own fleet that holds
  there.

## Vacation sends the guards home

* **[E]** At `startVacation` (`src/server/game/vacation.ts`), after the
  entry checks and the saving of the planets, every fleet in state `hold`
  at a planet or moon of the player (`heldAt`) flies home at once:
  `sendHome` of `src/server/game/holding.ts`, which uses `turnBack` like
  the end of holding and sets the return to now plus the flight time there
  (`homeAt` of `src/core/holding.ts`; a fleet whose holding time was over
  already counts from its end). The holding time that is left is dropped,
  the Promethium of the unused hours is not refunded (as after a recall),
  `recalled` stays false.
* **[E]** A Wache stellen that is still on its way when the host's vacation
  starts flies on (launched flights land, #223 D2) and **does not start to
  hold** at its arrival: `onArrive` of the mission
  (`src/features/missions/hold/arrive.server.ts`) sees that the host is in
  vacation and turns it home at once, with the same `sendHome` at the
  arrival time. The earlier behaviour, „arrives, holds and flies home“ at
  the end of its time, is gone.
* **[V]** The owner of a fleet that was sent home gets no notice of its own,
  as the end of holding gives none; he finds the report „Rückkehr zu …“ when
  the fleet is home, like after every Wache stellen (the mission is not
  silent). No new German text was needed.
* Unchanged: `vacationEntryError` counts every fleet of the player,
  whatever its state, so a player whose own fleet holds elsewhere cannot
  start the vacation while it is out.

## Mondbruch moves a held fleet to the planet

* **[E]** `destroyMoon` (`src/server/game/moons.ts`) reroutes with
  `fleets.reroute`; its `UPDATE` now takes the fleets in state `out` **and**
  `hold` (`src/server/db/repos/fleets.ts`; the missiles keep their target).
  A held fleet at the destroyed moon gets the planet as its place, keeps
  its ships, its cargo, its arrival and its holding time, so its end time is
  the same, and holds there until then; it defends the planet in the next
  fight. A fleet that already holds at the planet is untouched. No
  migration: only the target column of the rows changes.
* **[V]** The limits of the planet (15 fleets, four players besides the
  owner, `HOLD_LIMITS`) are not asked on the move: the fleet moves even if
  they are exceeded (the owner named no rule). Open point for the owner: the
  options are in the log entry
  `okf/log/2026-11-19-holding-three-decisions.md`.
* **[V]** The owner of such a fleet gets no notice of the move: he is
  informed of the moon's loss by the battle report of the Mondbruch when his
  fleet took part, and the fleets that fly to a broken moon get none either.
  The fleet movements show „hält bei“ the planet.

# Alliance depot (#55, later)

* **[E]** Values (owner, 2026-11-16, Q1, checked against owiki
  „Allianzdepot“): 20,000 Adamant and 40,000 Psikristall at level 1,
  factor 2, no requirement.
* **[E]** Supply: (2^level) × 10,000 Promethium per hour (owner,
  2026-11-16, owiki „Allianzdepot“: the real mechanic is exponential;
  the in-game text before 0.84 said 10,000 per level). This replaces the
  wiki value of the issue, 20,000 per level.
* **[E]** The holding mission lasts at most 32 hours; the depot extends
  it (owner, 2026-11-16, owiki „Allianzdepot“).
* **[U]** How the depot extends the holding time (classic: a supply
  rocket whose Promethium lasts the held fleet that much longer) is
  decided when the depot is built.

# Attack union (#225)

* **[E]** Limits (owner, 2026-11-16, D3): the classic values are the
  default, and the admin can change them per round. Verified: at most 16
  fleets of at most 5 players; a joining fleet may delay the union by at
  most 30 % of the remaining flight time (owiki „Allianzkampfsystem“).
* **[U]** Join window: no source gives a cut-off besides the 30 % rule
  (for example no joining in the last minutes); it is open for the build.
* **[E]** Loot (owner, 2026-11-16, Q1): split by free cargo space.
  Classic splits by cargo capacity („Laderaum“, owiki
  „Allianzkampfsystem“), and the source does not say „free“.
* **[E]** Recall by the leader (owner, 2026-11-16, Q2): the attack is
  cancelled for every fleet of the union, and all turn back. A deliberate
  deviation from classic: there a recall turned back only the recalled
  fleet, and the union flew on („Bei Verwendung des
  Allianzkampfsystems wirkt der Rückruf-Befehl nur auf den einzelnen
  Flottenverband.“, owiki „Rückruf“).
* **[V]** A participant's recall turns back only that participant's
  fleet (issue #225).

# Merged with the registry of round settings and #228 (2026-11-19)

* **[V]** Interactions checked after the merge, each with a test: a planet
  with a fleet that holds there, or from which a fleet holds elsewhere,
  cannot be given up ([Abandon colony](/features/abandon-colony.md); the
  flight check of `abandonError` counts every row of `fleets`, whatever its
  state); a jump through the Warp-Tor moves only the ships standing on the
  moon, and a fleet of another player that holds there stays and keeps
  defending ([Moons](/features/moons.md)); arrival and end of holding set
  no activity ([Activity indicators](/features/activity-indicators.md),
  „Fleets … set none“).
* **[V]** The article of the mission in the Lexicanum
  ([Lexicanum texts](/features/lexicanum-texts.md), „Wache stellen“): its
  text and keywords are a draft for the owner; the target of the mission
  reads „Planet eines Gildenmitglieds oder Freundes“ there.
* **[V]** Friends and the setting (#227 merged 2026-11-19): under „Freunde“
  and „Gilde und Freunde“ a friend can hold, also when he is no guild
  member; under „Gilde“ only a guild member can, and with guilds off only a
  friend. The client does not decide per planet whether „Wache stellen“ is
  offered: the fleet form offers the mission for every target and the state
  tells the client nothing about who is an ally, so the refusal of the
  server is the answer („Wache stellen nur bei Gildenmitgliedern und
  Freunden.“, or the words of the setting). #225 (attack union) reads the
  same value `allies`.
