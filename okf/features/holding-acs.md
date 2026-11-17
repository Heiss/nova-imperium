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

## Built with #55

* The mission is `hold` (`src/features/missions/hold/`), named „Wacht
  halten“ after the table of #94 ([Naming](/features/naming.md)) [V];
  the issue's „Haltezeit“ and „Gehaltene Flotten“ stay. Order 70, the new
  target kind `ally` (a foreign planet whose owner is an ally, which the
  mission's `canSend` asks), cargo, return, ships not shown while it flies
  there (as a transport), no guild alert, and the new typed field `holds`
  of every mission's rules (patterns, section 4).
* The rules live in `src/core/holding.ts` (holding times, limits, who is
  an ally, when a fleet is due); the fuel `holdFuel` in
  `src/core/flight.ts`; the server part in `src/server/game/holding.ts`.
* The admin's setting is `roundAllies` in `UNIVERSE_SPECS`, „Halten
  erlaubt für“ with the choices „Gilde“, „Freunde“ and „Gilde und
  Freunde“ [V] (1, 2, 3; default 3); the dialog „Neue Runde“ offers the
  same choice, kept without a choice like the lock of the main planet.
  A guild member counts only while guilds are on in the round
  ([Guilds on or off per round](/features/guild-switch.md)). Friends are
  nobody until the buddy list (#227) answers `areFriends` in
  `src/server/game/holding.ts`.
* The vacation mode (#223) protects a target of every mission in its own
  check of the target kind, so it covers holding once it is merged.
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
    overview with the owner, the origin, the ships and the time left. The
    host sees the ships of a fleet that holds, not of one on its way.
  * Every fleet that holds is a party of its own in the battle
    (`battleOf` of `src/core/battle.ts`); each of its owners gets the
    report of the defender once, with each fleet as „Verteidiger <name>“
    and its losses; a fleet without survivors is gone. A fleet of the
    attacker himself that holds there stays out of the battle.
  * The cargo of the held fleets is taken whole (not half) with the room
    left; the rest is lost with the fleets, which are destroyed when the
    attacker wins. 1 hour is preselected in the form.
  * The refusals: „Wacht halten nur bei Gildenmitgliedern und Freunden.“
    (by the setting „… nur bei Gildenmitgliedern.“ or „… nur bei
    Freunden.“), „An diesem Planeten halten bereits 15 Flotten.“, „An
    diesem Planeten halten bereits Flotten von 4 Spielern.“, „Bitte eine
    Haltezeit auswählen.“ and „Bitte auswählen, wer in der neuen Runde
    halten darf.“; a holding planet of a player in noob protection keeps
    „Dieser Spieler steht unter Noobschutz.“.

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
