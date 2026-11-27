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
* **[E]** Loot (owner, 2026-11-16, D3; replaced by #440, 233b: held
  cargo is no loot): the cargo of held fleets can be plundered too. This is a Nova rule: no classic source documents it;
  classic loot is 50 % of the planet's stock (owiki „Beute“), and owiki
  contradicts itself on whether held fleets keep their cargo.
* **[U]** How the cargo of held fleets enters the loot (its share and the
  order against the planet's stock) is not decided.
* **[V]** No holding at a player in vacation mode or in noob protection
  (the noob protection part replaced by #440, 238c), as in classic (owiki „Allianzkampfsystem“; see
  [Vacation mode](/features/vacation-mode.md)).
* **[E]** Loot (owner, 2026-11-17, completing the [U] above; replaced by
  #440, 233b): when a planet with held fleets is raided, the loot takes the classic 50 % of
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
* The admin's setting is `roundAllies`, „Verbündete für Halten und Verband“ with the
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
* **[E]** A detected spying at a planet with neither ships nor defense, but
  with a fleet that holds there, fights that fleet (owner, 2026-11-19; the
  rule of 2026-11-17, „a target with neither gives no battle“, counts the
  held fleets as ships). The chance of the Auspex-Abwehr still counts the
  planet's own ships only (owner, 2026-11-17), and the Auspex-Bericht shows
  the held fleets as they were before the battle.
* A fleet of the attacker himself that holds at the target stays out in the
  Mondbruch and the fight of the probes too.
* The Lexicanum draft of the mission says the fleet „verteidigt den Planeten
  in jedem Kampf“ ([Lexicanum texts](/features/lexicanum-texts.md)); that is
  true now, so no Lexicanum text changed. The article of the Mondbruch says
  nothing about held fleets.
* **[E]** Consequence of 1 together with 3 (seen when building; owner,
  2026-11-19, kept as built): the Mondbruch rolls only after a **won**
  battle, and a won battle leaves no defender. A foreign fleet that holds
  at the moon therefore fights and is destroyed whenever the moon can break;
  the move to the planet reaches only fleets that took no part in the
  battle: the attacker's own fleet that holds there.

## Vacation sends the guards home

* **[E]** At `startVacation` (`src/server/game/vacation.ts`), after the
  entry checks and the saving of the planets, every fleet in state `hold`
  at a planet or moon of the player (`heldAt`) flies home at once:
  `sendHome` of `src/server/game/holding.ts`, which uses `turnBack` like
  the end of holding and sets the return to now plus the flight time there
  (`homeAt` of `src/core/holding.ts`; a fleet whose holding time was over
  already counts from its end). The holding time that is left is dropped,
  `recalled` stays false. **[E]** The Promethium of the unused hours is not
  refunded, as after a recall (owner, 2026-11-19).
* **[E]** A Wache stellen that is still on its way when the host's vacation
  starts flies on (launched flights land, #223 D2) and **does not start to
  hold** at its arrival: `onArrive` of the mission
  (`src/features/missions/hold/arrive.server.ts`) sees that the host is in
  vacation and turns it home at once, with the same `sendHome` at the
  arrival time. The earlier behaviour, „arrives, holds and flies home“ at
  the end of its time, is gone.
* **[E]** The owner of a fleet that was sent home gets an info report, one
  per fleet, both at the start of the vacation and at the arrival at a host
  in vacation (owner, 2026-11-19); `sendHome` writes it with
  `addReport` (type `info`, push topic `fleet`, like „Flotte kehrt um“),
  time of the report the moment of the send-home. **[V]** The texts, drafted
  from the owner's wording: title „Wache heimgeschickt [g:s:p]“, text „Deine
  Wache bei <Ort> [g:s:p] wurde heimgeschickt: Der Gastgeber hat den
  Urlaubsmodus begonnen.“ (<Ort> is the name of the planet, for a moon
  „<Name> (Mond)“, as in the battle reports). The report „Rückkehr zu …“
  follows when the fleet is home, like after every Wache stellen.
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
* **[E]** The limits of the planet (15 fleets, four players besides the
  owner, `HOLD_LIMITS`) are not asked on the move: the fleet moves even if
  they are exceeded (owner, 2026-11-19).
* **[E]** The owner of every fleet that held at the moon gets an info
  report, one per fleet (owner, 2026-11-19), written by `destroyMoon` before
  the reroute (type `info`, push topic `fleet`, time of the arrival of the
  Mondbruch). The fleets that fly to the broken moon, the ones coming home
  from it and the attacker's other fleets get none. **[V]** The texts,
  drafted from the owner's wording: title „Wache wechselt zum Planeten
  [g:s:p]“, text „Der Mond [g:s:p] wurde zerstört; deine Wache hält jetzt am
  Planeten.“ The fleet movements show „hält bei“ the planet.

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
* **[E]** Join window (owner, 2026-11-17, completing the [U] of
  2026-11-16): the classic 30 % rule applies; an extra cut-off „no joining in
  the last N minutes“ is a value per round, **default off**; the values are
  set in „Neue Runde“ and stay editable in the admin panel (X1).
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

## Built with #225

Built on `claude/acs` after #55 (owner, 2026-11-17: „Build after #55“).
Everything below is [V] unless it names an owner's decision.

* **No research.** The issue's „their own research“ is each owner's weapons,
  shield and armour research in the battle, not a new catalog entry: the issue
  and its two „Geklärt“ comments name no research with costs or requirements,
  so none was built (values are never invented).
* **Data.** A fleet of a union carries `fleets.union_id`; the ID of a union is
  the ID of the fleet that opened it, its leader's Sturmangriff. The table
  `attack_union_invites` (union, invited player) holds the invitations.
  Migration `20261120T0900-attack-unions` (`src/server/db/migrations/225/`)
  adds the column with `ALTER TABLE` (no rebuild; a later rebuild of `fleets`
  must list `union_id`) and the table, which does not reference `fleets`. The
  rules are pure in `src/core/union.ts`, the server part is
  `src/server/game/union.ts` (actions `openUnion` and `inviteUnion`, the
  state key `unions`, order 210), the battle is the shared one of
  `src/server/game/fight.ts`, the arrival is the `onArrive` of the attack
  mission.
* **Settings (owner, 2026-11-16 D3, 2026-11-17, X1).** Four live number
  fields in „Neue Runde“ and the universe settings, the classic values as
  defaults: `roundUnionFleets` „Verbandsangriff: höchstens Flotten“ (16),
  `roundUnionPlayers` „Verbandsangriff: höchstens Spieler“ (5),
  `roundUnionDelay` „Verbandsangriff: Verspätung in Prozent der
  Restflugzeit“ (30), `roundUnionCutoff` „Verbandsangriff: kein Beitritt in
  den letzten Minuten (0 = aus)“ (0, off), order 200 to 230. The ranges 1 to
  50, 1 to 20, 0 to 100 and 0 to 1440 are [V]. Who may invite and join is the
  one value `roundAllies` of holding (D2); its label is „Verbündete für Halten und Verband“ (owner, [E]
  2026-11-20, #225), it governs the union too.
* **Opening.** An own Sturmangriff on its way (not recalled, not arrived, no
  gift, in no union) opens a union (`openUnion`); the leader invites a player
  by name (`inviteUnion`): an ally of the leader by the setting, not the
  owner of the target, not beyond the limit of players (the invited count
  against it); the invitee gets an info report „Einladung zum Verbandsangriff
  [g:s:p]“.
* **Joining.** A join is the action `send` with the field `union`: a
  Sturmangriff to the target of the union, with every check of an attack
  (ships, fuel, fleet slots, vacation and noob protection of the target for
  this attacker). The leader and a player already in the union need no
  invitation; everyone else needs one and must still be an ally of the
  leader. The limits of fleets and players are checked; a player in the
  union may send more fleets. Timing (owner: the 30 % rule): a fleet that is
  there in time waits and arrives with the union; a later one delays the
  union by at most `unionDelay` % of the flight time that is left, else it is
  refused, and then the arrival and the return of every fleet in the union
  move by the delay; a fleet that joins returns one flight of its own after
  the arrival. With a cut-off, nobody joins when the time left is at most N
  minutes (the boundary counts as inside); a union that has arrived is
  closed.
* **Recall.** The leader's recall of the fleet that opened the union turns
  back every fleet of it and ends it (owner, 2026-11-16, Q2); the owner of
  every other fleet gets an info report „Angriffsverband aufgelöst“. A
  participant's recall turns back only his own fleet, which leaves the union;
  the arrival of the union stays as it is (a delay is not taken back).
* **Arrival and battle.** All fleets of a union are due together. The first
  to be processed fights for all, in one battle: the leader's fleet leads,
  the others follow in the order they joined, each with the research of its
  own owner at the arrival (`battleOf` with several attacking parties, as
  the held fleets are several defending parties). The fleets leave the union
  and the invitations go before the battle; the later ones in the same tick
  find their fleet turned back and change nothing, so nothing is settled
  twice. A fleet of the owner of the target turns back; a union whose
  leading fleet is gone arrives as single fleets.
* **Loot (owner, 2026-11-16, Q1).** One loot as for a single attacker (half
  of the stock, then the cargo of the held fleets) against the free cargo
  space of all surviving ships together, split between the fleets in
  proportion to their free space, rounded down; the units left go one by one
  to the first fleets that still have room. Each fleet keeps its own cargo and
  flies home with it; a fleet without survivors is gone with its cargo.
* **Reports and debris.** Every owner of an attacking fleet gets the same
  report once (title by the result), with a block per further attacker
  (`attackers`: name, ships before and after, research, loot) and the loot
  share of the first (`attLoot`); the defender and the owners of held fleets
  get the report of the defender, titled „… wird von A, B und C angegriffen“;
  30 % of what every party lost lies as debris; the audit entry names the
  other fleets. **[V]** The browser shows the blocks (found by the E2E spec
  `e2e/union.spec.ts`, 2026-11-20: it had drawn the leader alone):
  `attackerSides` of `src/client/logic/report-body.ts` draws „Angreifer
  <Name>“ with the research and the table of losses for the first attacker
  and for each further one, in the order they joined and before the
  defender, and under each block „Erbeutet: …“ with its share when it took
  any (the existing words of the report; the whole loot stays in the line
  under the result).
* **Held fleets.** The fleets that hold at the target defend against the
  whole union, one party each. A fleet that holds at the target and belongs
  to any player of the union stays out of the battle, as the attacker's own
  does for a single attack.
* **Vacation.** A player in vacation can do nothing, so he cannot join; an
  attack on a player in vacation is refused like every attack, also for a
  join after the target started it (`sendError`).
* **Defender.** He sees each fleet as before (#228) and nothing of the
  union; the state key `unions` lists a union only to its leader, its
  members and the invited.
* **Browser.** The fleet view shows the box „Verbandsangriff“ with each union
  (leader, counts against the limits, fleets per owner, invited), the field
  for an invitation, the button „Beitreten“, which fills the fleet form with
  the target and the mission; the fleet form has the row „Verband“ and the
  arrival line of a joining fleet (with the delay or the reason of a
  refusal); the same box lists the own Sturmangriffe on their way with the
  button „Angriffsverband eröffnen“ and says that the recall of the leader's
  fleet turns back the whole union; the fleet movements show „· Angriffsverband
  (Anführer)“ or „· im Angriffsverband“ behind an own fleet of a union, and
  their markup is otherwise unchanged (the reference test of the overview
  keeps it).
* **Texts [V].** „Angriffsverband eröffnen“, „Beitreten“, „Einladen“,
  „Kein Verband“, „Verband“, „Sturmangriff auf …“, the hint on the recall, the
  refusals of `src/server/game/union.ts` and `joinMessage` of
  `src/core/union.ts`, the reports above.
* **Not part of a union:** the Mondbruch, missiles, spying and every other
  mission.

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

## Label of the ally setting (#225, 2026-11-20)

* **[E]** (owner, 2026-11-20, #225) `roundAllies` is labelled „Verbündete für
  Halten und Verband“ everywhere it is shown (registry entry, „Neue Runde“,
  live admin settings, Lexicanum „Dieses Universum“), because it governs
  holding and the attack union.
* **[V]** The fragment `changes/wacht-halten.md` names friends too („zum
  Planeten eines Gildenmitglieds oder Freundes“), as friends may hold (#55,
  #227).

# Rework of 2026-11-27 (#440)

The owner's decisions on #440, built on `claude/hold-rework`.

* **[E]** Round setting „Wache stellen“ An/Aus, default An, order 105,
  live (240a): off, the fleet form does not offer the mission, the server
  refuses a launch, and every running hold turns home. A universe without
  the key reads An (`roundHoldOn`, as `roundMarketOn`; no migration).
* **[E]** Every hold, flying or holding, is checked again (229a, 282a):
  when a friendship ends, when a guild member leaves or is removed, when a
  guild is dissolved, when the settings of the round are saved („Wache
  stellen“, „Verbündete“), at a new round, at every score pass, when a host
  switches „Keine Wachen annehmen“ on, and at the start of the server
  (which also covers an update); no timer of its own. [V] (review of #455)
  The score pass checks in the beat of the clock, once per stored pass and
  in a write transaction, never in a read of the state; in a round with
  live points (0 passes a day) the score pass checks nothing. The start
  checks after the first beat, which lands what came due during the
  downtime, so a hold that arrived meanwhile ends at its arrival. A hold that is no
  longer allowed turns home at once from where it is: one that holds as
  at the end of its holding time, one on its way like a recall (231a). Its
  owner gets the info report „Deine Wache bei {Planet} kehrt zurück:
  {Grund}.“ with the reason `off`, `refused` or `bond`.
* **[E]** A hold that is no longer allowed at its arrival turns home there
  with the same report (4a). The vacation report stays as it was.
* **[E]** „Wegschicken“ per hold under „Gehaltene Flotten“, holding or on
  its way (230b); the owner gets „{Spieler} hat deine Wache bei {Planet}
  weggeschickt. Deine Flotte kehrt zurück.“.
* **[E]** The player option „Keine Wachen annehmen“, default off (230b):
  on, a launch to the player is refused and the running holds turn home
  (282a). Table `hold_refusals` (migration `20261127T1800-hold-refusals`),
  kept across rounds.
* **[E]** A hold at a weak host is allowed (238c). While a fleet of another
  player than the host holds at a place, the host's noob protection does
  not apply there for attacks and espionage (281b); missiles keep it. A
  fleet on its way does not count yet.
* **[V]** (review of #455, owner asked) Only the hold of a third player
  lifts it: one of neither the host nor the attacker or spy, so nobody can
  hold at a weak friend and then attack him. The Sternenkarte follows the
  same rule for the viewer.
* **[V]** While „Wache stellen“ is off (okf/ops/feature-switches.md),
  „Wegschicken“ and „Keine Wachen annehmen“ are refused with the refusal of
  the switch, the option box is hidden, and the Lexicanum hides the article
  of the mission (`offered` of its rules, as #404 for the pages). The
  refusal of a launch is the mission's own (`offered.refusal`).
* **[E]** Held cargo is no loot (233b); the debris and the moon chance of
  destroyed held fleets stay.
* **[E]** The host gets „{Spieler} schickt eine Wache zu {Planet}.
  Ankunft: {Zeit}.“ at the launch and „{Spieler} hält mit einer Flotte
  Wache bei {Planet} bis {Zeit}.“ at the arrival (242c). All hold reports,
  to host and owner, are pushed under the topic „Wachen“ (order 75; 243b,
  283a); the vacation report stays under „Flotte“.
* **[V]** The Mondbruch counts as an attack here: it asks the same check
  of the target as the Sturmangriff, so it loses the protection at that
  place too.
* **[V]** The Sternenkarte: the state lists the places of the shown system
  whose protection lapsed (`lapsed`), and the (n) is not shown there; the
  missile refusal stays the server's.
* **[V]** „Gehaltene Flotten“ lists a hold on its way with the words of an
  incoming fleet and its arrival as the countdown; it is no movement then.
* **[V]** The option is a box of its own in „Optionen“ (order 35, section
  „Spiel“); the checkbox saves at once with the action `holdOption`.
* **[V]** The Lexicanum: the clauses that a hold at a weak host is refused
  and that held cargo is loot are removed from „Wache stellen und
  Verbandsangriff“, „Kampf“ and „Schutz der Schwachen“; the Noobschutz list
  of missions no longer names „Wache stellen“.
* **[U]** Texts not decided yet, built as marked placeholders
  (`src/core/hold-texts.ts`): the three {Grund} texts, the two refusals,
  the four report titles, the title of the option box, the two Lexicanum
  lines (lapsed protection, held cargo no loot) and the changelog
  fragment `changes/wache-stellen-ueberarbeitet.md`.
