---
type: feature
title: Abandon a colony
description: A player gives up a colony that nothing refers to any more, loses everything on it with its moon, and the position is locked for a time the admin sets per round (issue #224).
---

# Abandon a colony

Issue #224, part of the Classic features (#222). The owner's answers of
2026-11-16 to D1 to D3 and Q1. Classic source: owiki.de „Zerstörter
Planet“ (https://owiki.de/index.php?title=Zerst%C3%B6rter_Planet&oldid=76922).

# Decisions

* **[E]** Running references (owner, 2026-11-16, D1): giving up is refused
  while flights, research or orders refer to the planet or its moon.
* **[E]** Position (owner, 2026-11-16, D2): the admin sets per round how
  long the position stays locked before it can be colonized again (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[E]** Default 24 h, the classic minimum: a destroyed planet stayed at
  least 24 hours and was removed in the nightly run, so 24 to 48 hours
  (owiki „Zerstörter Planet“) (owner, 2026-11-16).
* **[E]** X1 (owner, 2026-11-17): the lock is set in the dialog „Neue
  Runde“ and stays changeable by the admin during the round.
* **[E]** Main planet (owner, 2026-11-16, D3): the chosen main planet
  (#221) cannot be given up; the player changes the main planet first.
  #221 was clarified the same day (see [Main planet](/features/main-planet.md)).
* **[E]** Moon and stock (owner, 2026-11-16, Q1): everything is lost, the
  buildings, units, resources, orders and the moon. Classic differs: the
  destroyed planet kept its buildings, fleet and resources until the
  deletion and could still be attacked (owiki „Zerstörter Planet“).

# Built

* **[V]** Password: the confirmation asks for the password like „Account
  löschen“ (field „Passwort zur Bestätigung“), and the server refuses a
  wrong one with the same message, „Das bisherige Passwort ist falsch.“,
  before any other check; the address is limited like the deletion of the
  account (`PASSWORD_ACTIONS`, `src/server/http/app.ts`). The audit entry
  holds the planet, the moon and the end of the lock, never the password.
* **[V]** The main planet of D3 is the one of #221 as the game uses it:
  the chosen planet, or the first planet without a choice. So the last
  planet is never given up either. The first planet can be given up once
  another planet is the main planet; the oldest planet left then becomes
  the „Heimatplanet“ (rewards, Endzeit gift).
* **[V]** D1 counts every flight of any player that starts from or flies to
  the planet or its moon (also one on its way back), the research of the
  player when it runs on the planet or its moon (#49), and a building or
  shipyard order on either. A planet id is its place (`src/core/place.ts`),
  so nothing is left that could point to a colony founded later at the
  same coordinates; the main-planet choice cannot point there either (D3).
* **[V]** The lock is a setting of the round, `roundAbandonLock`, in whole
  hours from 1 to 720 (30 days, the upper bound of the main-planet lock),
  read by `roundRules()` (24 without the setting). The dialog „Neue Runde“
  has a number field „Sperre einer aufgegebenen Position (Stunden)“,
  preselected with the current round, like the lock of the main planet; the
  admin's refusal is „Bitte für die Sperre einer aufgegebenen Position 1
  bis 720 ganze Stunden angeben.“ X1: the same stored setting is a row of
  the universe settings („Sperre einer aufgegebenen Position (Stunden)“,
  `roundAbandonLock` in `UNIVERSE_SPECS`), changed live and audited like
  the other settings (`settings`, `admin.write` with before and after); a
  change counts for colonies given up afterwards, a running lock keeps its
  end. The lock runs in real time and starts when the colony is given up;
  a new round forgets every lock.
* **[V]** While the lock holds, the position takes no colony: the server
  refuses a Landnahme with „Diese Position ist gesperrt. Wieder besiedelbar
  ab <Datum, Uhrzeit>.“ (in the time of Berlin, like the main-planet lock;
  code `locked` of `sendError`), a Landnahme that arrives during the lock
  turns back like one at an unsuitable target, and no new home planet is
  placed there. The Sternenkarte shows the position as free.
* **[V]** The rules are pure functions in `src/core/abandon.ts` (patterns,
  section 7): `abandonTargetError` (codes `unknown`, `moon`, `main`),
  `abandonError` (then `flights`, `research`, `orders`, in this order),
  `positionLockEnd`, `positionLocked` (the lock holds while now < end) and
  `isAbandonLockHours`. The server (`src/server/game/abandon.ts`, action
  `abandon` with `target`, the planet id, and `password`) gathers the
  values and words the codes; `src/server/game/position-lock.ts` holds the
  lock for the colonization and the placement.
* **[V]** The overview („Übersicht“) of an own planet that is not the main
  planet shows a red button „Kolonie aufgeben“ below the planet's data
  (the browser asks `abandonTargetError`); a moon and the main planet show
  none. The confirmation names the planet with its coordinates, the
  losses (building levels, ships, defense, the stock and the moon by name),
  that the position is locked for the hours of the round, „Diese Aktion
  kann nicht rückgängig gemacht werden.“ and the password. It sends the
  planet it was opened for, never one shown meanwhile.
* **[V]** Messages: „Die Kolonie <Name> [g:s:p] wurde aufgegeben.“;
  refusals „Das ist keiner deiner Planeten.“ (as for the main planet), „Ein
  Mond kann nicht allein aufgegeben werden.“, „Der Hauptplanet kann nicht
  aufgegeben werden. Wähle zuerst einen anderen Hauptplaneten.“, „Die
  Kolonie kann nicht aufgegeben werden, solange Flotten zu ihr oder ihrem
  Mond unterwegs sind oder von dort kommen.“, „… solange dort geforscht
  wird.“, „… solange auf ihr oder ihrem Mond gebaut wird.“
* **[V]** Stored: the table `position_locks`, migration
  `20261117T0540-position-locks` (see [SQLite storage](/data/sqlite.md)).

# Tests

* Unit: `src/core/abandon.test.ts` (the lock boundaries as a property, the
  codes and their order), `src/core/missions.test.ts` (the code `locked`),
  `src/client/logic/abandon.test.ts` (the button and the confirmation),
  `src/client/logic/overview.test.ts`, `src/client/views/misc.test.ts` (the
  field of the dialog), `src/test/overview-reference.test.ts` (the frozen
  overview with the button).
* Server: `src/server/game/abandon.test.ts` (the password, every refusal
  changes nothing, everything lost with the moon, the lock per round, the
  colonization and the placement during and after the lock, a colony
  founded again at the same coordinates without an old reference),
  `src/server/db/repos/planets.test.ts`, `src/server/http/app.routes.test.ts`
  (the limit and the audit without the password).
* Upgrade: `src/server/db/upgrades/20261117T0540-position-locks.test.ts`.
* E2E: `e2e/abandon-colony.spec.ts`, desktop and phone, with axe on the
  overview and the confirmation, the refusals of a wrong password and of
  the main planet, and the refused colonization of the locked position.

# Out of scope

* Giving up a moon on its own (classic since v0.77b); see
  [Moons](/features/moons.md).
