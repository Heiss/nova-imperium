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
