---
type: feature
title: Vacation mode
description: A player pauses the account through the options, production stops and every planet and moon is protected, with a minimum duration the admin sets per round (issue #223).
---

# Vacation mode

Issue #223, part of the Classic features (#222). The owner's answers of
2026-11-16 to the open points D1 to D3, Q1 and Q2. Classic source:
owiki.de „Urlaubsmodus“
(https://owiki.de/index.php?title=Urlaubsmodus&oldid=78097).

# Decisions

* **[E]** Minimum duration: the admin sets it per round (owner, 2026-11-16,
  D1; see [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** Default 24 h, the classic value of speed universes; normal
  universes had 48 h (owiki „Urlaubsmodus“) (owner, 2026-11-16).
* **[E]** Entry (owner, 2026-11-16, Q1): nothing may run, so no own fleets
  in flight and no building, research or shipyard orders. This is the
  classic rule (owiki „Urlaubsmodus“: activation needs no own fleet
  movements, and before v4.1 no running build or research).
* **[E]** Hostile fleets already on the way (owner, 2026-11-16, D2): entry
  is allowed; attacks launched before it land as usual, new missions
  against the player are refused. This matches the classic text „Bereits
  gestartete Angriffe sowie friedliche Flottenaktionen anderer Spieler
  werden jedoch fortgesetzt.“
* **[E]** During the vacation (owner, 2026-11-16, Q2): production is
  paused, the player takes no own actions, and all planets and moons are
  protected. Classic before 1.0 differs in one point: the base production
  went on during vacation mode and stopped only with the Redesign (owiki
  „Urlaubsmodus“).
* **[E]** New round (owner, 2026-11-16, D3): a new round ends the vacation
  mode, and the player gets a notice.
* **[E]** Ending (owner, 2026-11-17): a button „Urlaubsmodus beenden“
  becomes active after the minimum duration (classic, owiki
  „Urlaubsmodus“); a new round ends every vacation anyway (D3).
* **[E]** X1 (owner, 2026-11-17): the minimum duration is set in the
  dialog „Neue Runde“ and stays changeable by the admin during the round.
* **[E]** The wording of the notice at a new round is the builder's [V]
  (owner, 2026-11-17).

# Proposals

* **[V]** The protection covers the new missions of the Classic features
  too: holding and joining an attack union at the player
  ([Holding and ACS](/features/holding-acs.md)) and missiles
  ([Missiles](/features/missiles.md)); classic missiles cannot target a
  player in vacation mode either (owiki „Interplanetarrakete“).

# Built

* **[V]** The minimum duration is a setting of the round,
  `roundVacationHours`, in whole hours from 1 to 720 (30 days, the range
  of the abandon lock of #224), read by `roundRules()` (24 without the
  setting). The dialog „Neue Runde“ has a number field „Mindestdauer des
  Urlaubsmodus (Stunden)“, preselected with the current round; the
  admin's refusal is „Bitte für die Mindestdauer des Urlaubsmodus 1 bis
  720 ganze Stunden angeben.“ X1: the same stored setting is a row of the
  universe settings („Mindestdauer des Urlaubsmodus (Stunden)“ in
  `UNIVERSE_SPECS`), changed live and audited like the other settings.
* **[V]** A change of the minimum duration counts for running vacations
  too: the earliest end is the start plus the current setting, like the
  lock of the main planet (#221), so only the start is stored.
* **[V]** Entry: the options („Hilfe & Optionen“) have a box
  „Urlaubsmodus“ that explains the mode, names what blocks the entry
  („Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs
  sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet
  wird.“) and offers „Urlaubsmodus aktivieren“, which asks first
  („Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach 24
  Stunden.“). The server answers „Urlaubsmodus aktiviert.“ or refuses with
  „Der Urlaubsmodus kann nicht aktiviert werden, solange eigene Flotten
  unterwegs sind.“, „… solange gebaut wird.“, „… solange geforscht wird.“,
  „… solange die Schiffsschmiede arbeitet.“ (in this order; the wording of
  the abandon refusals of #224). Q1 counts every own fleet out or back,
  not the gift of the Endzeit (which takes no slot either), a building
  order on any own planet or moon, the research, and a shipyard order
  waiting or running. A building or research that is done at the entry is
  taken in first.
* **[V]** At the entry every own planet and moon is settled to the entry
  instant and saved; the start is stored in `users.vacation`. `settle`
  (`src/core/settle.ts`) produces up to the start at most and moves the
  place on without production (`producesUntil` in `src/core/vacation.ts`),
  for the server and the browser alike, so the pause holds after a
  restart. At the end every place is settled to the end the same way, so
  the production goes on from then on.
* **[V]** During the vacation the box shows „Du bist im Urlaubsmodus.“,
  „Frühestens beendbar am <Datum, Uhrzeit>“ (in the browser's time, like
  the main-planet box) and „Urlaubsmodus beenden“, disabled before that
  time. The server refuses an early end with „Der Urlaubsmodus ist
  frühestens beendbar am <Datum, Uhrzeit>.“ (in the time of Berlin, like
  the main-planet lock), the end without a vacation with „Du bist nicht im
  Urlaubsmodus.“ and answers „Urlaubsmodus beendet.“
* **[V]** No own actions (Q2): every action but the options, the push
  kinds, the messages, renaming a planet, the main planet, the end of the
  vacation, the guild actions and the admin's actions is refused with „Im
  Urlaubsmodus nicht möglich.“ (`vacationRefuses`, asked by `runAction`
  before the action). An action added later is refused too, so a new game
  action needs no change here. The guild actions and renaming change
  nothing of the game; the admin's actions are not those of a player.
* **[V]** Protection (D2, Q2): every new mission of another player to a
  planet or moon of a player in vacation mode is refused with „Dieser
  Spieler ist im Urlaubsmodus.“ (code `vacation` of `sendError`, before
  the noob protection), peaceful ones too: the classic text continues only
  „bereits gestartete … friedliche Flottenaktionen“. A Bergung at the
  position stays, the Trümmerfeld is no place of the player. Flights
  launched before the entry land as usual (the arrival does not ask).
  `vacationProtects` in `src/core/vacation.ts` is the one check of a
  target; holding and ACS (#55, #225), missiles (#54) and the moon
  destruction (#95) call it when they are built.
* **[V]** The Sternenkarte marks the owner of a planet in vacation mode
  with „(u)“ (title „Urlaubsmodus“), beside the „(n)“ of the noob
  protection; the state carries `vacation` per player and the own start
  in `me.vacation`.
* **[V]** New round (D3): every vacation ends; a player whose vacation it
  ended finds the report „Urlaubsmodus beendet“ with „Die neue Runde hat
  deinen Urlaubsmodus beendet.“ (push kind „announcement“, like a server
  message).
* **[V]** A suspension by the admin (moderation) and the vacation mode are
  independent: neither starts, ends or pauses the other.
* **[U]** The Auspex-Phalanx (#53) still scans a planet of a player in
  vacation mode; whether the protection covers the scan is not decided.

# Tests

* Unit: `src/core/vacation.test.ts` (the codes and their order, the end as
  a property, the protection, the refused actions, the pause as a
  property), `src/core/settle.test.ts` (the pause), `src/core/missions.test.ts`
  (the code `vacation`), `src/core/universe.test.ts`,
  `src/client/logic/vacation.test.ts` (the box, the question, the mark),
  `src/client/views/galaxy.test.ts`, `src/client/views/misc.test.ts` (the
  field of the dialog).
* Server: `src/server/game/vacation.test.ts` (the entry and each refusal,
  no production also after a restart, the refused actions, the refused
  missions and the landing of a launched attack, the end before and after
  the minimum duration, the live change, the round setting, the new round
  with its notice, the state), `src/server/db/repos/players.test.ts`.
* Upgrade: `src/server/db/upgrades/20261117T1000-vacation-mode.test.ts`.
* E2E: `e2e/vacation.spec.ts`, desktop and phone, with axe on the options
  before and during the vacation, the refused build and early end, the
  „(u)“ and the refused attack of another player, and the end after the
  minimum duration.
