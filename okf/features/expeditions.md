---
type: feature
title: Expeditions and position 16
description: The mission „Expedition“ to the position after the last planet position with the research Kreuzzugs-Kartografie (classic Expeditionstechnik), its outcomes, slots and holding time, and debris from its battles (issue #93).
---

# Expeditions and position 16

Issue #93, part of the Classic features (#222). The owner's answers of
2026-11-16 to Q1 to Q5 and the completion of 2026-11-17, checked against
owiki.de. Sources:

* „Expeditionstechnik“ (https://owiki.de/index.php?title=Expeditionstechnik&oldid=78794)
* „Expedition“ (https://owiki.de/index.php?title=Expedition&oldid=79024)
  and its discussion page with the old version of the article
  (https://owiki.de/index.php?title=Diskussion:Expedition&oldid=77157)
* „Changelog Redesign“ (https://owiki.de/index.php?title=Changelog_Redesign&oldid=79011)

Expeditions came with v0.78 on 20 November 2007.

# Decisions

* **[E]** Research (owner, 2026-11-16, Q1, classic values verified): the
  classic Expeditionstechnik, not Astrophysik. 4,000 Adamant, 8,000
  Psikristall, 4,000 Promethium, factor 2; needs Forschungslabor 3,
  Spionagetechnik 4 and Impulstriebwerk 3 (owiki „Expeditionstechnik“).
* **[E]** Slots and holding time (owner, 2026-11-16, Q3): the classic
  values are the default, and the admin can change them per round (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
  Verified: ⌊√level⌋ expeditions at the same time; at most as many hours at
  the expedition position as the level of the technology (owiki
  „Expeditionstechnik“).
* **[E]** Fleet slot (owner, 2026-11-17): an expedition takes a normal fleet
  slot and is also limited by the expedition slots (classic, owiki
  „Expedition“).
* **[E]** The expedition position (owner, 2026-11-16, Q4): the position right
  after the last planet position of the universe (16 with 15 positions, 21
  with 20), one per system; it cannot be colonized and is visible in the
  Sternenkarte.
* **[E]** Outcomes (owner, 2026-11-16, Q2): the classic outcomes of v0.78
  by the source, without Dunkle Materie: nothing, finds of resources, finds of
  ships, a battle with pirates or aliens, the loss of the fleet, and the
  change of the return time; every event but the loss comes as normal, large
  or very large (owiki „Diskussion:Expedition“).
* **[E]** Probabilities (owner, 2026-11-16, Q2): the owiki values from
  version 1.4.1 on are the basis: about 84 % of the expeditions bring an
  event, the size of an event is normal 89 %, large 10 %, very large 1 %.
  The owner completed it on 2026-11-17: the chance per event is „the
  per-event table of owiki v1.4.1“, the size of finds the owiki rule that
  scales with the points of rank 1, the return-time event really changes
  the return, earlier or later.
* **[E]** The trader event is left out until a market exists; it may come
  with #171 (owner, 2026-11-16).
* **[E]** Debris (owner, 2026-11-16, Q5): battles of an expedition leave a
  Trümmerfeld at the expedition position, and the Bergungsbarke can harvest
  it with the mission Bergung like any other field
  ([Trümmerfelder](/features/debris.md)). A deliberate deviation from
  classic (owiki „Expedition“: „Diese Kämpfe hinterlassen aber nie ein
  Trümmerfeld.“; it came only with version 7.0.0, owiki „Changelog
  Redesign“).
* **[E]** Per-round values (owner, 2026-11-17, X1): in the dialog „Neue
  Runde“ and, changeable during the round, in the admin panel.
* **[V]** Name of the research from [Grimdark naming](/features/naming.md):
  Kreuzzugs-Kartografie (package order). The mission keeps the name of the
  issue, „Expedition“.

# Built

Mission folder `src/features/missions/expedition/` (order 100, target kind
`expedition`, no cargo, returns, not visible, not silent), research folder
`src/features/expo/` (key `expo`, order 170), rules in `src/core/expedition.ts`
(pure, every draw takes the generator it is given) and `src/core/expedition-ships.ts`
(expedition points and the find of ships, apart because they read the
catalog).

* **Research** with the values above; **[V]** abbreviation „KK“, the short and
  the long text, the picture (the one of the Auspex-Lehre under its own
  name until one is drawn).
* **Target.** `TargetKind` `expedition`: only the position
  `positions + 1` of an existing system (`isExpeditionPlace`), never a
  planet or a moon. `SendTarget.expedition` is set by the server;
  `sendError` refuses another position with `notExpedition`, a moon with
  `moonTarget`, and every free-position mission (Landnahme, Vermessung) at
  that position with `expeditionSpace`. The fleet form and the send action
  accept the position beyond the planet positions. The arrival turns the
  fleet back („Flotte kehrt um“) when the position is no longer the expedition
  position, e.g. after the admin enlarged the universe.
* **Slots.** `canSend` refuses without level 1 (`expeditionLocked`) and with
  all ⌊√level⌋ places taken (`expeditionSlots`); the places count the
  expeditions out and on their way home (`SendFleet.running`,
  `fleets.countMission`). The fleet slot is checked as for every mission.
* **Stay.** The player chooses whole hours from 1 to the level
  (`MissionRules.maxHold`); the server refuses more with „Die Haltezeit
  beträgt höchstens N Stunden.“. The fleet arrives when the stay ends:
  `arr = start + flight + stay`, `ret = arr + flight`. No column holds the
  stay; it is what lies between `dep`, `arr` and `ret` (`stayOf`). The
  stay is in real hours, not divided by the universe speed (open point 3).
* **Recall.** An expedition can be recalled until its stay ends. The way
  home takes `min(time flown so far, flight out)`, so a fleet that already
  stays at the position returns in one flight; for every other mission this
  is the old rule.
* **Events** (`arrive.server.ts`, `drawEvent`): one draw per arrival, a
  report with the owner, an audit entry (`system`, `expedition`, detail
  fleet, kind, size) and the flight home:
  * *nothing*, *loss* (the fleet is deleted, no debris);
  * *resources* (owiki „Rohstofffund“): base number even 10 to 50, 50 to 100
    or 100 to 200 by size; Adamant : Psikristall : Promethium = 3 : 2 : 1
    (the base halved for Psikristall, divided by three for Promethium);
    times the expedition points of the fleet (structure points · 5 / 1000),
    at least 200 and at most 2,400, 6,000, 9,000 or 12,000 by the points of
    rank 1 (below 100,000, up to 1,000,000, up to 5,000,000, above); at
    most the cargo space minus half the fuel burnt;
  * *ships* (owiki „Flottenfund“): structure points of the find = base
    number (10 to 50, even 52 to 100, even 102 to 200) times the expedition
    points up to 1,250, 3,000, 4,500 or 6,000, at least 10,000; findable are
    the ships up to one step heavier than the heaviest of the fleet (Spähschädel,
    Frachtläufer, Abfangjäger, Lastbarke, Sturmjäger, Fregatte, Kathedralschiff,
    Jagdkreuzer, Belagerungsbomber, Vernichter; Kolonistenarche,
    Bergungsbarke and Weltenbrecher neither find nor are found); the ships
    join the fleet;
  * *pirates* and *aliens* (owiki „Kämpfe gegen andere Flotten“): they
    attack, the fleet defends. Per ship type a share (pirates 30 / 50 / 80 %
    rounded down, aliens 40 / 60 / 90 % rounded up, each within a tenth
    around the mean) plus extra ships (5 Abfangjäger, 3 Fregatten, 2
    Kathedralschiffe; 5 Sturmjäger, 3 Jagdkreuzer, 2 Vernichter); their
    weapons, shield and armour levels three below (pirates, at least 0) or
    three above (aliens) those of the owner. The shared `battle` fights; the
    destroyed ships of both sides leave 30 % as a Trümmerfeld at the
    position; the report is a battle report; the ships left fly home;
  * *earlier* and *later return* (owiki „Veränderte Flugzeit“): the factor
    2, 3 or 5 by size times the stay; later: the flight home takes that much
    longer; earlier: a third of it shorter, but at least a second.
* **Sternenkarte.** The row after the last planet position („Expeditionsposition“,
  position 16 or 21) with the button „Expedition“ (research level 1 and a ship
  that flies on the shown planet), the Trümmerfeld there and its „Bergung“.
  The fleet form takes the position, shows the row „Haltezeit“ for a mission
  that stays, the title counts „Expeditionen (n / m)“.
* **Database.** Migration `20261118T2319-expeditions`
  (`src/server/db/migrations/93/migrations.ts`) rebuilds `fleets` and
  `fleet_ships` for the mission in the CHECK; it lists every mission and
  keeps every column ([SQLite storage](/data/sqlite.md)).
* **Vacation.** An expedition is sent through `send`, which the general gate
  refuses for a player in vacation mode; the vacation does not start while
  an expedition flies (all own fleets count). No player is the target, so
  `vacationProtects` is not asked. Tests in `src/server/game/vacation.test.ts`.
* **Abandon, Mondbruch, highscore.** A colony an expedition started from
  cannot be given up while it flies (the existing flight check); the fleet of
  a destroyed moon comes home to the planet; the ships away and the ships
  found count for the fleet score (#78).
* **[V]** The mission takes no cargo; finds fill the holds.
* **[V]** Lexicanum (#285): `src/features/expo/lexicon.de.ts`,
  `src/features/missions/expedition/lexicon.de.ts`; the words are drafts in
  [Lexicanum texts](/features/lexicanum-texts.md).

# Report texts [V]

All German texts of the reports are drafts, written from the decided
outcomes and existing game terms; they are not owiki's flavour texts. The
owner confirms or changes them.

* Title „Expedition [g:s:p] – <subject>“ with the subjects „nichts entdeckt“,
  „Rohstofffund“, „Schiffsfund“, „Flotte verloren“, „Rückkehr früher“,
  „Rückkehr später“; a battle report is titled „Kampfbericht [g:s:p] –
  gewonnen“, „verloren“ or „unentschieden“ (from the fleet's side), place
  „Expeditionsposition“, attackers „Piraten“ or „Aliens“.
* Nothing: „Die Expedition hat nichts Besonderes gefunden und kehrt heim.“
* Resources: „Die Expedition hat einen kleinen | einen großen | einen sehr
  großen Rohstofffund gemacht: N Adamant | Psikristall | Promethium kommen
  mit der Flotte heim.“; without room: „Die Expedition hat Rohstoffe
  gefunden, aber ihre Laderäume sind zu klein, um etwas davon
  mitzunehmen.“
* Ships: „Die Expedition hat einen kleinen | … Schiffsfund gemacht, die
  Schiffe schließen sich der Flotte an: 2 Abfangjäger, 2 Spähschädel.“;
  none: „Die Expedition hat nach Schiffen gesucht, aber keine gefunden, die
  sich der Flotte anschließen.“
* Loss: „Von der Expedition kam nur noch ein abgerissener Funkspruch. Die
  Flotte ist verloren.“
* Later: „Die Expedition hat sich verirrt und kehrt später als geplant
  zurück.“ Earlier: „Die Expedition hat einen kürzeren Weg gefunden und
  kehrt früher als geplant zurück.“
* Refusals: „Expeditionen erst mit Kreuzzugs-Kartografie.“, „Alle
  Expeditionsplätze belegt.“, „Expeditionen fliegen nur zur
  Expeditionsposition.“, „Die Expeditionsposition kann nicht besiedelt
  werden.“, „Die Haltezeit beträgt höchstens N Stunde | Stunden.“
* Interface: the mission „Expedition“, the row „Haltezeit“ („Stunden am
  Ziel“), the note „Expeditionsposition“, „nur für Expeditionen“, the
  title „Expeditionen (n / m)“.

# Open

1. **[U] The share of each event among the expeditions that bring one is not
   decided, so the events are off.** The owner named „the per-event table of
   owiki v1.4.1“ (2026-11-17), but the article has none (the cited revision
   and the discussion page were read). It states only: about 84 % bring an
   event; of 3,000 expeditions with an event the simulation assumes 300 raids
   (pirates twice as often as aliens: 200 and 100, each 90 / 9 / 1 %
   normal, large, very large) and 10 total losses; metal finds 18 to 20 %
   (so resources about 36 to 40 %); three quarters of the changes of the
   return time are delays; a French statistic of 22,860 expeditions gives
   pirates 6 % and aliens 2.7 % of all; the statistics page of the source
   (cogame.timestorm.de) cannot be reached. The shares of ships,
   delay and early return are not stated, and Dunkle Materie and the Händler,
   which are left out, took their share of the 84 %. `EVENT_SHARES` in
   `src/core/expedition.ts` is `null`: every expedition finds nothing and
   comes home; one constant switches the events on, all rules above are
   built and tested with handed-in shares. Options: (a) the owner gives the
   table; (b) Claude derives the raids and the loss from the numbers above
   (pirates 6.7 %, aliens 3.3 %, loss 0.33 % of the events), takes resources
   37.5 % (the middle of 36 to 40) and leaves about 52 % for ships and the
   change of the return time, three quarters of the latter later; the split
   between ships and the return time is a proposal, [V] until confirmed; (c) as (b) but with the French statistic for the raids; (d) all
   seven events equally likely (not classic); (e) only finds, nothing and the
   change of the return time first, the battles and the loss with a later pull
   request.
2. **[U] The setting per round (Q3, X1) has no form yet**, so it is not built:
   the slots and the stay are the classic formulas (`expeditionSlots`,
   `maxHoldHours`), fixed. Options for the form, always in the dialog „Neue
   Runde“ and live in the admin panel, one array of settings from order 300
   in `src/core/expedition.ts`: (a) two whole numbers „in percent of
   classic“ (slots and stay, 100 = classic, 10 to 1,000); (b) „zusätzliche
   Expeditionsplätze“ (default 0) and „Haltezeit in Stunden je Stufe“
   (default 1); (c) a highest number of slots and of hours, default none; (d)
   a switch between the classic formula and „as many slots as levels“; (e)
   one setting „Haltezeit“ only, the slots stay classic.
3. **[U] Stay and universe speed.** Built in real hours, as the owner's
   decision says („level hours“). owiki divides the stay by the universe
   speed in its text (and notes a hotfix that did not); this game's flights
   are divided by it (default 5). Options: (a) real hours as built; (b)
   divided by the speed like a flight; (c) a setting.
4. **[V] Sizes of finds.** The rule of the article with its four tiers of
   rank 1 (the 8-tier table of version 5.7.5 is not used); a tier edge belongs
   to the lower tier (up to and including 1,000,000 and 5,000,000, 100,000 to
   the second). The owner's „earliest sourced, v0.83“ is not on the cited
   page, so which version's caps are meant is not verified. The „points of
   rank 1“ are the points of the total highscore.
5. **[V] Ships found.** The article leaves open how often the draw repeats;
   built: it stops at the first drawn ship that is heavier than what is left.
6. **[V] Return time.** The factors 2, 3 and 5 follow the sizes 89 / 10 / 1 %
   (owiki: „sehr häufig“, „selten“, „sehr selten“); the share of early returns
   (a quarter) belongs to the table of point 1.
7. **[V] Places and slots.** The expeditions on their way home still hold a
   place; the position is „positions + 1“ at each arrival (see above).
8. **[V]** The mission takes no cargo; the recall rule above; texts above;
   abbreviation „KK“ and the picture of the research.
9. Not built, not decided: the load of a position by many expeditions
   (owiki: fewer events at often visited positions), the Spähschädel hint
   about it, the Astrophysik colony limit (owner: classic Expeditionstechnik).
