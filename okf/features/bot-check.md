---
type: feature
title: Check for automated play
description: „Automatisierung prüfen“ per player in the admin's player record, off by default and on until the admin turns it off, with raw facts from the server since the switch-on (actions, actions without active play time, hits of the action limit, the gaps between actions), at most 30 days, no score and no consequence, and the rule „Fair spielen“ in the Lexicanum (issue #181).
---

# Check for automated play

* **[E]** (owner, 2026-11-14) Letting an AI or a program operate the
  interface is not allowed; the game can check it. D1: the admin switches
  the check on for one player; it is off by default.
* **[E]** (owner, 2026-11-21) D2: only hints for the admin, a list of what
  is conspicuous; no automatic warning or suspension, the admin decides with
  the existing moderation. D3: at first only what the server sees anyway;
  signals of the browser only after a separate decision on the data (#232:
  the browser sends no key, position or scroll data). D4: kept 30 days, like
  the audit log. D5: a general rule in the Lexicanum and one sentence in the
  changelog; no message to a player when the check is switched on for them.
  Not retroactive: worked out only from the moment the switch is turned on.
  The switch stays on until the admin turns it off.
* **[V]** (coordinator, 2026-11-21, Q37 to Q40) Raw facts only, no
  threshold, no verdict, no mark „auffällig“; worked out when the admin
  opens the record, no table of hints; only the newest period (switching off
  and on again starts anew).

## As built

* **[V]** The switch is a row of `bot_checks` (migration
  `20261121T1900-bot-check`): the player and `since`, the moment of the
  switch-on. No row is off. The row stays over a new round and goes with
  the account (`ON DELETE CASCADE`). The route `POST /api/admin/bot-check`
  (`{ player, on }`) is an admin write; its audit entry `admin.write` /
  `botCheck` names the admin (actor), the player (target), the time and
  `{ on }`. A player that does not exist and a missing on/off are refused.
* **[V]** The hints are part of the player record (`POST
  /api/admin/player`, an admin read as before): `botCheck: { since, days }`
  from `src/server/game/bot-check.ts` and the pure `src/core/bot-hints.ts`.
  The sources are what the server keeps anyway: the game actions of the
  audit log of that player (category `game`; the entries `rateLimit` are the
  hits of the action limit of #328, which the audit notes at most once an
  hour per account) and the intervals of active play time of #231. Both are
  read from `max(since, now − 30 days)`: the audit log keeps 30 days, the
  play time until the round is deleted, so the cut of 30 days is made by the
  hints (pinned by a test with older data still present).
* **[V]** A day (UTC) is shown when it has an action or a hit, newest first:
  the number of game actions; of them, those in no interval of active play
  time; the hits of the action limit; and of the gaps between two
  successive actions of that day the shortest, the median and the middle
  half (half of the gaps lie between the two values, a quarter below and a
  quarter above; the nearest-rank quartiles, in seconds to a tenth). This
  spread is the only measure: a very regular rhythm shows as a narrow middle
  half, a fast one as small values; there is no threshold.
* **[V]** Account deletion: the audit rows of the account (as actor or
  target) are deleted by `deleteAccount`, the play time and `bot_checks` go
  by `ON DELETE CASCADE`; the hints read nothing else (not the journal).
* **[V]** The player cannot tell: nothing of the check is in the state or
  in an answer (a test compares the state and an answer with the check on
  and off). The admin's page shows it in its own block below „Diagnose und
  Protokoll“ (`AdminBotCheck.svelte`), so the record keeps its frozen
  reference of #118.

## Texts [V]

* Admin: heading „Automatisierung“; the checkbox „Automatisierung prüfen“;
  „Nicht geprüft“ / „Geprüft seit <Datum, Uhrzeit>“; „Auffälligkeiten seit
  dem Einschalten“; „Nur Tatsachen, keine Bewertung. Ein Treffer der
  Aktionsgrenze wird höchstens einmal je Stunde vermerkt.“; a line per day
  „<Datum>: <n> Aktionen, davon <k> ohne aktive Spielzeit; <h> Treffer der
  Aktionsgrenze; Abstände: kürzester <a> s, Median <b> s, mittlere Hälfte
  <c> s bis <d> s“ (1 Aktion in the singular); „Noch keine Aktionen seit dem
  Einschalten.“; refusals „Spieler nicht gefunden.“, „Bitte an oder aus
  wählen.“
* Lexicanum: the new rule page „Fair spielen“ (`rule-fair`, after „Dieses
  Universum“; the Lexicanum had no page of rules of conduct, so the smallest
  fitting place is a page of its own) with „Das Spiel darf nicht von einer
  KI oder einem Programm bedient werden: Jede Aktion kommt von dir. Die
  Spielleitung kann das für einzelne Spieler prüfen.“
  ([Lexicanum texts](/features/lexicanum-texts.md)).
* Changelog `changes/fair-spielen.md` (art: neu): „Regeln: Das Spiel darf
  nicht von einer KI oder einem Programm bedient werden; die Spielleitung
  kann das prüfen.“

## Not built

* Signals of the browser (D3: a separate decision), a score, a threshold.
