---
type: feature
title: Main planet
description: A player chooses the main planet („Hauptplanet“) among the own planets in the options; it decides navigation and research, every switch starts a lock the admin sets per round, 7 days by default (issue #221).
---

# Main planet

Issue #221, part of the Classic features (#222). The owner's request of
2026-11-15 and the answers to D1 to D6 in the comment „Geklärt“ (owner,
2026-11-16).

# Decisions

* **[E]** The first (oldest) planet is the main planet by default and does
  not change by itself; the player switches it to another own planet in
  the options (owner, 2026-11-15). The main purpose: the link „zum
  Heimatsystem“ of the Sternenkarte leads where the player wants.
* **[E]** D1, what the main planet decides: navigation plus research
  (owner, 2026-11-16).
  * The link „zum Heimatsystem“ on the Sternenkarte leads to its system.
  * It is the planet shown when none is selected.
  * The research view uses it as its planet.
  * Rewards (achievements and the daily reward), the Endzeit gift and the
    field rule stay with the first planet (`planets.home()`).
* **[E]** D2, name (owner, 2026-11-16): „Hauptplanet“ for the chosen
  planet; „Heimatplanet“ stays the name of the first planet.
* **[E]** D3, lock (owner, 2026-11-16): set by the admin per round, 7 days
  by default, like the other round values (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** D4 and D5 (owner, 2026-11-16): every switch starts the lock, the
  first one too and a switch back to the first planet too. The first switch
  is always possible, since nothing locked it before.
* **[E]** D6 (owner, 2026-11-16): if the main planet is no longer the
  player's, it falls back to the oldest planet the player still has,
  without a lock. Today no game path causes this; it is only a safeguard.
* **[E]** The chosen main planet cannot be given up (#224 D3, see
  [Abandon a colony](/features/abandon-colony.md)); the player changes the
  main planet first.
* **[V]** A moon cannot be the main planet (a moon is never the home planet,
  [Moons](/features/moons.md)).
* **[V]** Fields: the 163 fields stay with the planet that got them; a
  switch moves no fields, buildings or resources (out of scope of the
  issue).

# Built

* **[V]** What „research“ of D1 covers: the two places where research used
  the home planet: research started before #49 has no planet, so its
  cancel refunds the main planet and the research view names the main
  planet as its place; and research without a selection starts on the
  main planet. Research still starts on the shown planet (#49, see
  [Requirements](/features/requirements.md)); the Endzeit refunds
  overtaken research of before #49 on the first planet, as part of its
  gift.
* **[V]** Stored per player: `users.main_planet` (the chosen planet, null
  for the first planet) and `users.main_switched` (the time of the last
  switch), migration `20261116T2211-main-planet` (see
  [SQLite storage](/data/sqlite.md)). Existing players start without a
  choice and without a lock. A new round forgets the choice and its lock,
  because a planet id is its place and could come back.
* **[V]** The lock is a setting of the round, `roundMainLock`, in whole
  days from 1 to 30, read by `roundRules()` (7 without the setting). The
  dialog „Neue Runde“ has a number field „Sperre nach einem Wechsel des
  Hauptplaneten (Tage)“, preselected with the current round, like the
  guild switch (#191) changed only there; the choice is part of the audit
  entry of the round reset. The lock runs in real time, not with the speed
  of the universe.
* **[V]** The rules are pure functions in `src/core/main-planet.ts`
  (patterns, section 7): `canBeMain`, `mainOf` (D6), `mainLockEnd`,
  `mainLocked` (the lock holds while now < end) and `mainSwitchError`
  (codes `unknown`, `moon`, `same`, `locked`, in this order). The server
  (`src/server/game/main-planet.ts`, action `mainPlanet` with `main`, the
  planet id) turns them into German messages; the options view asks
  `mainLocked` too.
* **[V]** The state carries `mainPlanet` and `mainLock` (the end of a lock
  that still holds) beside `homePlanet`, which stays the first planet. The
  link „zum Heimatsystem“ (handler `ghome` in `src/client/main.ts`), the
  refresh without a planet and the research place read `mainPlanet`; the
  Sternenkarte's files are unchanged.
* **[V]** The options („Hilfe & Optionen“) have a box „Hauptplanet“ below
  „Optionen“: a short explanation with the lock of the round, a selection
  of the own planets (never moons; the first planet with „ – Heimatplanet“,
  the main planet preselected) and „Ändern“. While the lock holds, both are
  disabled and the box says „Wieder änderbar ab <Datum, Uhrzeit>“ in the
  browser's time.
* **[V]** Messages: „<Name> ist jetzt dein Hauptplanet.“; refusals „Der
  Hauptplanet ist gesperrt. Wieder änderbar ab <Datum, Uhrzeit>.“ (in the
  time of Berlin, like the mails), „Ein Mond kann nicht Hauptplanet sein.“,
  „Das ist keiner deiner Planeten.“, „Das ist bereits dein Hauptplanet.“;
  for the admin „Bitte für die Sperre des Hauptplaneten 1 bis 30 ganze
  Tage angeben.“.

# Tests

* Unit: `src/core/main-planet.test.ts` (the lock boundaries, D4, D5, D6,
  the refusals), `src/client/logic/main-planet.test.ts` (the box),
  `src/client/views/misc.test.ts` (the field of the dialog).
* Server: `src/server/game/main-planet.test.ts` (the action, the lock per
  round, the new round, D6, the planet shown, actions and research without
  a selection, the daily reward and the Endzeit gift on the first planet),
  `src/server/http/app.routes.test.ts` (the audit of an action without a
  selection).
* Upgrade: `src/server/db/upgrades/20261116T2211-main-planet.test.ts`.
* E2E: `e2e/main-planet.spec.ts`, desktop and phone, with axe on the
  options.
