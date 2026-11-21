---
type: feature
title: Expeditions and position 16
description: The mission „Expedition“ to the position after the last planet position with the research Kreuzzugs-Kartografie (classic Expeditionstechnik), its outcomes with their shares, slots, stay and settings per round, and debris from its battles (issue #93).
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
* **[E]** Share of each event (owner, 2026-11-19, the former open point 1):
  derived from owiki, the raids by the French statistic: pirates 6 % and
  aliens 2.7 % **of all expeditions**; a total loss 0.33 % and a find of
  resources 37.5 % **of the events**; about 84 % of the expeditions bring an
  event. **[V]** (main agent) for the rest: the find of ships and the change
  of the return time share what is left half and half, and three quarters of
  the changes are a later return, a quarter an earlier one. The arithmetic
  is below, „Shares of the events“. The sizes stay 89 / 10 / 1 %; the trader
  and Dunkle Materie stay out.
* **[E]** Settings per round (owner, 2026-11-19, the former open point 2):
  „Zusätzliche Expeditionsplätze“ (default 0, added to ⌊√level⌋) and
  „Haltezeit in Stunden je Stufe“ (default 1), in the dialog „Neue Runde“ and
  in the admin panel. **[V]** (main agent) the ranges 0 to 10 and 1 to 24.
* **[E]** Stay and universe speed (owner, 2026-11-19, the former open point
  3): one setting per round decides whether the stay is divided by the
  universe speed. **[V]** (main agent) default off: real hours, as built;
  label „Haltezeit durch das Universums-Tempo teilen“.
* **[E]** Texts (owner, 2026-11-19, fast-build rule): the German texts that
  are not decided are drafts, marked **[V]** here with their wording; they
  ship with the update and the owner checks them afterwards.
* **[V]** Name of the research from [Grimdark naming](/features/naming.md):
  Kreuzzugs-Kartografie (package order). The mission keeps the name of the
  issue, „Expedition“.

# Built

Mission folder `src/features/missions/expedition/` (order 110, after the
Raketenangriff at 100; target kind `expedition`, no cargo, returns, not
silent, `holds` false), research folder
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
  all ⌊√level⌋ places plus the extra places of the round taken
  (`expeditionSlots(level, extra)`, `expeditionSlots` as code); the places
  count the expeditions out and on their way home (`SendFleet.running`,
  `fleets.countMission`), the extra places come from `SendFleet.extraSlots`
  (`extraSlots(universe)`). The fleet slot is checked as for every mission.
* **Stay.** The player chooses whole hours from 1 to level times the hours
  per level of the round (`MissionRules.maxStay(research, hoursPerLevel)`);
  the server refuses more with „Die Haltezeit beträgt höchstens N Stunden.“,
  N being hours, whatever the speed does to them. The real stay is
  `stayDuration(hours, universe)`: the hours in milliseconds, or divided by
  the universe speed, rounded to a millisecond, when the switch of the round
  is on. The fleet arrives when the stay ends: `arr = start + flight + stay`,
  `ret = arr + flight`. No column holds the stay; it is what lies between
  `dep`, `arr` and `ret` (`stayOf`), so the changed return times below work
  from the real stay. The payload key is `stay` (hours); `hold` is the
  holding time of a Wache stellen and is ignored by an expedition.
* **An expedition is not a Halten.** `MissionRules.maxStay` (the stay of an
  expedition) and `holds` (a Wache stellen, #55: defends the planet, burns
  fuel for its time, state `hold`, column `hold`) are different things. An
  expedition stays in the state `out` until its stay ends, keeps no holding
  time, burns no fuel for the stay and is never counted by `heldAt` or
  `holdersAt` (both ask `holds`); the recall rule of the overview (own, not
  on its way home, a fleet of the form) lets the player call a staying
  expedition back, as built before, and the server recalls it by the stay
  rule below. The fleet form keeps the two in rows and fields of their own:
  the holding time `t_hold` / `t_h` (a selection) and the stay `t_stay_row`
  / `t_stay` (a number), only one of the two is in the page, so no label
  exists twice.
* **Recall.** An expedition can be recalled until its stay ends. The way
  home takes `min(time flown so far, flight out)`, so a fleet that already
  stays at the position returns in one flight; for every other mission this
  is the old rule (`recalledAt` in `fleet-actions.ts`, which keeps the rule
  of a Halten: as long as its flight to the target took).
* **Events** (`arrive.server.ts`, `drawEvent`, on since 2026-11-19 with the
  shares below): one draw per arrival, a
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
  The fleet form takes the position, shows the row „Haltezeit“ (a number of
  hours, the real time beside it when the universe speed divides the stay)
  for an expedition, the title counts „Expeditionen (n / m)“ with the extra
  places.
* **Shares of the events** (`EVENT_SHARES`, `src/core/expedition.ts`):
  among the expeditions that bring an event (84 %). Pirates 6 % and aliens
  2.7 % of all expeditions are divided by 0.84: pirates 0.06 / 0.84 =
  0.0714286, aliens 0.027 / 0.84 = 0.0321429. Total loss 0.0033, resources
  0.375 (both of the events, as the owner gave them). What is left is
  1 − (0.375 + 0.0033 + 0.0714286 + 0.0321429) = 0.5181286 **[V]**: half to
  the find of ships, 0.2590643, and half to the change of the return time,
  0.2590643, of which three quarters are later, 0.1942982, and a quarter
  earlier, 0.0647661. In the order of the draw: resources, ships, pirates,
  aliens, loss, earlier, later; they sum to 1 (a test checks it, and each
  outcome and each boundary of the draw). Over all expeditions that is:
  nothing 16 %, resources 31.5 %, ships 21.76 %, pirates 6 %, aliens 2.7 %,
  loss 0.28 %, earlier 5.44 %, later 16.32 %. The constants are named with
  their source in the code.
* **Settings per round** (`roundSettings`, `src/core/expedition.ts`, one
  fieldset „Expeditionen“, all `live`, so rows of the universe settings
  too): `roundExpeditionExtraSlots` „Zusätzliche Expeditionsplätze“ (order
  300, 0 to 10, default 0), `roundExpeditionHours` „Haltezeit in Stunden je
  Stufe“ (order 310, 1 to 24, default 1) and `roundExpeditionSpeed`
  „Haltezeit durch das Universums-Tempo teilen“ (order 315, a choice Nein /
  Ja, default Nein). **[V]** The switch is a number of 0 and 1 with choices,
  because a switch of the registry cannot be live (as the marketplace does);
  the order numbers 300, 310 and 315 are free ones between the other
  features' and the marketplace (320 to 430); the ranges and the defaults
  are in the decisions above. No central list is edited; the registry is
  generated.
* **Database.** Migration `20261119T1700-expeditions`
  (`src/server/db/migrations/93/migrations.ts`) rebuilds `fleets` and
  `fleet_ships` for the mission in the CHECK; it runs after the rebuilds of
  Wache stellen (`20261119T0744-holding`), the Mondbruch, the survey and the
  missiles, lists every mission and every state (`out`, `hold`, `back`) and
  keeps every column, `hold` and `aim` among them ([SQLite
  storage](/data/sqlite.md)). It is unreleased, so its ID moved once.
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
* New with the settings (2026-11-19, **[V]**): beside the stay, only when
  the universe speed divides it, „entspricht 1h 00m 00s (durch Tempo 5
  geteilt)“ (the real time, the speed of the universe); the choices of the
  switch „Nein“ and „Ja“; the legend of the fieldset „Expeditionen“. The
  labels of the three settings are the owner's, the first two verbatim from
  the comment, the third from the main agent. The refusal of a stay names
  hours („Die Haltezeit beträgt höchstens N Stunde | Stunden.“) as the
  player enters them; the report texts above name no duration, so they stay
  true with the switch on.
* New in the Lexicanum (**[V]**, drafts in [Lexicanum
  texts](/features/lexicanum-texts.md)): the article of the research adds
  „der Admin kann für die Runde zusätzliche Plätze dazugeben“ and that the
  admin sets the hours per level and can have the universe speed divide the
  stay; the mission article says the same in short.

# Open

The three open points of 2026-11-17 (the share of each event, the form of
the setting per round, stay and universe speed) were decided by the owner
on 2026-11-19 and are in „Decisions“ above, with the [V] parts marked.

1. **[V] Sizes of finds.** The rule of the article with its four tiers of
   rank 1 (the 8-tier table of version 5.7.5 is not used); a tier edge belongs
   to the lower tier (up to and including 1,000,000 and 5,000,000, 100,000 to
   the second). The owner's „earliest sourced, v0.83“ is not on the cited
   page, so which version's caps are meant is not verified. The „points of
   rank 1“ are the points of the total highscore.
2. **[V] Ships found.** The article leaves open how often the draw repeats;
   built: it stops at the first drawn ship that is heavier than what is left.
3. **[V] Return time.** The factors 2, 3 and 5 follow the sizes 89 / 10 / 1 %
   (owiki: „sehr häufig“, „selten“, „sehr selten“); the split of the shares
   between ships and the return time and the quarter of early returns are the
   main agent's [V] of 2026-11-19.
4. **[V] Places and slots.** The expeditions on their way home still hold a
   place; the position is „positions + 1“ at each arrival (see above).
5. **[V]** The mission takes no cargo; the recall rule above; texts above;
   abbreviation „KK“ and the picture of the research.
6. **[V] The statistics of owiki** (cogame.timestorm.de) could not be
   reached; the shares rest on the numbers of the article and the French
   statistic the owner named. Dunkle Materie and the Händler, which are left
   out, took a share of the 84 % in the source; it is spread over the other
   events here.
7. Not built, not decided: the load of a position by many expeditions
   (owiki: fewer events at often visited positions), the Spähschädel hint
   about it, the Astrophysik colony limit (owner: classic Expeditionstechnik).
