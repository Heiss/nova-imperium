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
* **[E]** Default 48 h (owner, 2026-11-18), the classic value of normal
  universes; speed universes had 24 h (owiki „Urlaubsmodus“). The owner
  first chose 24 h (2026-11-16); the setting and its range stay.
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
* **[E]** After the build (owner, 2026-11-17): every new mission of
  another player against someone in vacation mode is refused, peaceful
  ones included (transport, espionage, holding, missiles). Fleets launched
  before the vacation still arrive; the recovery of a Trümmerfeld at the
  position stays allowed.
* **[E]** The Auspex-Phalanx may scan a planet whose owner is in vacation
  mode (owner, 2026-11-17).
* **[E]** The German texts of the build are confirmed (owner, 2026-11-17).
* **[E]** After the build (owner, 2026-11-18), replacing the allow list of
  the build: nothing is allowed in vacation mode. The server refuses every
  own action except ending the vacation mode and the push settings of the
  account; guild actions, renaming a planet, choosing the main planet, the
  game options and reading (reports, messages, guild chat) are refused too.
  After the login the player sees a lock screen instead of the game: a
  notice and the button „Urlaubsmodus beenden“, greyed out with a notice
  while the minimum duration lasts. After the click the vacation ends and
  the player sees the interface. On the lock screen the player can sign out
  and reach the account options (password, passkeys, push settings, delete
  account). Only the player's own actions are locked: others can still
  write to the player and manage him in the guild and see it afterwards.
* **[V]** The texts of the lock screen, to be checked by the owner (owner,
  2026-11-18): title „Urlaubsmodus“, text „Dein Konto ist im
  Urlaubsmodus.“, button „Urlaubsmodus beenden“, while locked „Du kannst
  den Urlaubsmodus in <Restzeit> beenden.“ with the duration format of the
  client (`dur`, e.g. „47h 59m 03s“). The lock screen otherwise uses the
  existing texts: „Logout“ and the boxes of the options.
* **[V]** The Lexicanum says nothing about the vacation mode (main agent,
  2026-11-18).

# Proposals

* **[V]** The protection covers the new missions of the Classic features
  too: holding and joining an attack union at the player
  ([Holding and ACS](/features/holding-acs.md)) and missiles
  ([Missiles](/features/missiles.md)); classic missiles cannot target a
  player in vacation mode either (owiki „Interplanetarrakete“).

# Built

* **[V]** The minimum duration is an entry of the registry of the round
  settings (#283, [Admin](/features/admin.md#the-registry-of-the-round-settings-283)):
  `VACATION_SETTING` in `src/core/vacation.ts`, listed in `ROUND_SETTINGS`
  (`src/core/round.ts`), stored under `roundVacationHours`, named
  `vacationHours` in `RoundRules` and in the request „reset“, in whole
  hours from 1 to 720 (30 days, the range of the abandon lock of #224),
  default 48 (also without the setting), `order` 150 (the numbers 60 to 90
  are taken on main by #229, 100 to 140 by the open branches of #55 and
  #228). The dialog „Neue
  Runde“ shows the number field „Mindestdauer des Urlaubsmodus (Stunden)“
  (`round-vacation-hours`), preselected with the current round, last after
  the lock of a given-up position; it is no group, so no fieldset. The
  admin's refusal is „Bitte für die Mindestdauer des Urlaubsmodus 1 bis
  720 ganze Stunden angeben.“ X1: the entry is `live: true`, so the same
  stored setting is a row of the universe settings („Mindestdauer des
  Urlaubsmodus (Stunden)“, after the lock of a given-up position), changed
  live and audited like the other settings. No hand wiring is left in the
  dialog, the reset action, `roundRules()` or `UNIVERSE_SPECS`.
* **[V]** A change of the minimum duration counts for running vacations
  too: the earliest end is the start plus the current setting, like the
  lock of the main planet (#221), so only the start is stored. The admin
  changes it from another account; an admin in vacation mode cannot.
* **[V]** Entry: the options („Hilfe & Optionen“) have a box
  „Urlaubsmodus“ that explains the mode, names what blocks the entry
  („Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs
  sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet
  wird.“) and offers „Urlaubsmodus aktivieren“, which asks first
  („Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach 48
  Stunden.“ with the default). The server answers „Urlaubsmodus aktiviert.“ or refuses with
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
* **[V]** During the vacation the player sees the lock screen
  (`src/client/views/vacation-lock.ts`, shown by `renderLock` from
  `render()` in `main.ts`; the state is `me.vacation !== null`, see
  below). It holds the title „Urlaubsmodus“, „Dein Konto ist im
  Urlaubsmodus.“, the button „Urlaubsmodus beenden“, „Logout“ and the boxes
  „Passwort ändern“, „Passkeys“, „Benachrichtigungen“,
  „Browser-Benachrichtigungen“ and „Account löschen“ of the options (shared
  with `help()` through `passwordBox`, `passkeysBox`, `notificationBoxes`).
  The menu, the header and the resource bar are empty. Before the end of
  the minimum duration the button is disabled and `aria-describedby` names
  the notice „Du kannst den Urlaubsmodus in <Restzeit> beenden.“ next to
  it, so the reason is text, not only grey; the clock of the lock screen
  counts the notice down every second and turns the button on at the end
  without a reload. The server refuses an early end with „Der Urlaubsmodus
  ist frühestens beendbar am <Datum, Uhrzeit>.“ (in the time of Berlin,
  like the main-planet lock), the end without a vacation with „Du bist
  nicht im Urlaubsmodus.“ and answers „Urlaubsmodus beendet.“ The box
  „Urlaubsmodus“ of „Hilfe & Optionen“ only offers the start now.
* **[V]** The state for a player in vacation mode (`lockedState` in
  `src/server/game/state.ts`) keeps the shape of the full state but holds
  none of the game: no planet, fleet, report, guild, player, galaxy or
  Trümmerfeld, no research and no admin data; only the rules of the round
  and the universe, `me` with the id, the name, the push kinds that are off
  and `vacation` (the start; from it and `round.vacationHours` the browser
  knows the earliest end). The same state comes after „Urlaubsmodus
  aktivieren“ and at every refresh, so a second device locks too.
* **[V]** Nothing but the end and the push settings (Q2, owner,
  2026-11-18): only `endVacation` and `pushOptions` are on the allow list
  of `vacationRefuses` (`src/core/vacation.ts`), asked by `runAction` before
  the action; every other action is refused with „Im Urlaubsmodus nicht
  möglich.“, an action added later too, so a new action needs no change
  here: the guild actions, `options`, `rename`, `mainPlanet`, `read`,
  `delrep`, `delall`, the Warp-Tor jump `jump` (#230), giving up a colony
  `abandon` (#224), the admin's actions `settings`, `reset` and `endzeit`
  and `startVacation` itself. A test runs every key of `ACTIONS` against
  the allow list. The routes outside `runAction` stay as they were: the
  password change, the deletion of the account, the passkey routes, the
  push routes, the sign-out, the news and `GET /api/state`, which answers
  the lock state. The admin routes (`/api/admin/…`) are not actions of the
  player and stay; the admin panel is not shown on the lock screen.
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
  protection (`vacation` of a place in `galaxyPage`, `src/client/logic/galaxy.ts`,
  shown by `Galaxy.svelte`); the state carries `vacation` per player and the own start
  in `me.vacation`.
* **[V]** New round (D3): every vacation ends; a player whose vacation it
  ended finds the report „Urlaubsmodus beendet“ with „Die neue Runde hat
  deinen Urlaubsmodus beendet.“ (push kind „announcement“, like a server
  message).
* **[V]** A suspension by the admin (moderation) and the vacation mode are
  independent: neither starts, ends or pauses the other.
* **[E]** The Auspex-Phalanx (#53) scans a planet of a player in vacation
  mode (owner, 2026-11-17); `scan` checks no vacation of the target. A
  player in vacation mode cannot scan himself: the scan is an own action.

# Tests

* Unit: `src/core/vacation.test.ts` (the codes and their order, the end as
  a property, the protection, the refused actions, the registry entry, the
  pause as a property), `src/core/round.test.ts` (the entry in the order of
  the registry), `src/core/settle.test.ts` (the pause),
  `src/core/missions.test.ts` (the code `vacation`),
  `src/core/universe.test.ts`, `src/client/logic/vacation.test.ts` (the
  box, the question, the time left), `src/client/views/vacation-lock.test.ts` (the lock screen),
  `src/client/logic/galaxy.test.ts` and `src/client/views/galaxy.test.ts` (the mark „(u)“),
  `src/client/views/misc.test.ts` (the field of the dialog).
* Server: `src/server/game/vacation.test.ts` (the entry and each refusal,
  no production also after a restart, the refused actions, the refused
  missions and the landing of a launched attack, the end before and after
  the minimum duration, the live change, the round setting, the new round
  with its notice, the state; „the Warp-Tor, giving up a colony and the
  Auspex-Phalanx“: `jump` and `abandon` refused and working again after
  the end, every action off the allow list refused, the scan of a planet
  in vacation mode allowed), `src/server/game/round.test.ts` (the live
  rows and the order of the refusals), `src/server/db/repos/players.test.ts`.
* Upgrade: `src/server/db/upgrades/20261117T1000-vacation-mode.test.ts`.
* E2E: `e2e/vacation.spec.ts`, desktop and phone: the start in the options,
  the lock screen with axe, the refused actions and early end, the lock
  after a reload, no menu, the „(u)“ and the refused attack of another
  player, the login on the lock screen, the button that turns on by
  itself and the end. `e2e/a11y.spec.ts`: the lock screen with the button
  off and on. Routes: `src/server/http/app.routes.test.ts` („the vacation
  mode“).
