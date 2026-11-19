---
type: feature
title: Own activity and play time
description: The private statistics „Meine Aktivität & Spielzeit“ in „Hilfe & Optionen“, how they count across rounds and days, how long they are kept and when a new session starts (issues #231 and #232).
---

# Own activity and play time

Issues #231 (the view in „Hilfe & Optionen“ → „Meine Aktivität &
Spielzeit“) and #232 (the measurement of the play time), part of the
Classic features (#222). They change no game rule. #231 D1 to D3 and the
model of #232 (states, scroll and focus, a heartbeat every 30 s, a
timeout of 60 s) are decided in the issues; the public activity markers
are [Activity indicators](/features/activity-indicators.md).

# Decisions

* **[E]** Counting (owner, 2026-11-16, #231 D4): sums per account and per
  round, days in UTC; the data stay across the round reset.
* **[E]** Retention (owner, 2026-11-16, #231 Q1): as long as the round
  archives (#235); the view shows since when it records („Erfasst seit …“).
* **[E]** Sessions (owner, 2026-11-16, #232 Q1): a new session starts after
  a pause of 30 minutes.
* **[E]** Model (owner, 2026-11-15, #232): three states. **Active**: the page
  is visible and focused and a trusted click, key or scroll happened within
  the last 60 s. **Inactive**: no such interaction for 60 s. **Background**:
  hidden or without the focus. Only active counts. A page that is active
  reports every 30 s and at each change of state; coming back to the
  foreground does not resume by itself; the 60 s deadline is the last
  interaction, never a heartbeat. Rendering, countdowns, the state refresh
  and polling are no interaction. Scroll events are coalesced in the page
  (they only note the time) and no key, position or scroll offset is sent.
* **[E]** Source of the totals (owner, 2026-11-16 and 2026-11-17, #231, #232):
  the accepted intervals are stored as events and every total (day, round,
  account) is derived from them on read; no statistics table, no counter.
  They are kept until the admin deletes the round (#235), not by the 30-day
  purge of the audit log. During a running round the numbers are private; after
  it they appear in the archive (#235 D2).
* **[E]** The words (owner, 2026-11-15, #232): the metric is „Geschätzte
  aktive Spielzeit“; the explanation is „Gezählt wird die geschätzte Zeit mit
  aktiver Nutzung. Nach 60 Sekunden ohne Eingabe oder Scrollen sowie beim
  Verlassen des aktiven Fensters pausiert die Erfassung. Kurze Lesepausen
  zählen mit.“ The view has „Meine Aktivität & Spielzeit“, „Heute (UTC)“,
  „Letzte 7 Tage (UTC)“, „Spielaktionen“, „Zuletzt aktiv“, „Erfasst seit …“.

# What is built (#232, #231)

* **[V]** The page (`src/client/features/playtime.ts`, the state machine in
  `src/client/logic/playtime.ts`) sends `POST /api/playtime` with
  `{ instance, seq, state, since }`: `instance` is a random id of the page
  (new on every load), `seq` counts the reports of the page, `state` is
  `active`, `inactive` or `background`, `since` the active milliseconds since
  the page's previous report on its monotonic clock, up to the change of state,
  and `null` for the first report of an interval. Reports: one when an
  interaction makes the page active (the start, `since` null), one every 30 s
  while active, one at the 60 s deadline (`inactive`) and one when the page is
  hidden, loses the focus or is left (`background`, with `keepalive`). A
  failed report is not repeated.
* **[V]** The rule on the server (`judge` in `src/core/playtime.ts`): a report
  that is not newer (`seq`) than the page's last one is ignored; the first
  report of an interval earns nothing; any other credits an interval that
  ends now and is as long as the claim, at most 30 s and at most the time since
  the page's last accepted report, so no interval overlaps its predecessor
  and a claim is never believed beyond the heartbeat. An interval continues
  only while the page's last report was active and at most 60 s ago (two
  missed heartbeats, the inactivity timeout); a heartbeat after more than 60 s
  starts a new interval instead and never bridges the gap, a report that ends
  an interval without one open is ignored. A lost stop, a closed tab, a
  restart or a network loss therefore only cost the last unconfirmed part.
  The state of a page is read from its last stored event, so a restart opens
  and doubles nothing.
* **[V]** The limit in `judge` (`src/core/playtime.ts`), so that no honest
  sequence loses time. A heartbeat (an `active` report that continues an open
  interval) is stored while the interval holds no more heartbeats than whole
  heartbeat intervals have passed since its start row (`beatsTooSoon`): the
  count is of the interval, so a heartbeat that arrives up to a whole interval
  early or late is still stored, and a page that beats every 30 s stores every
  beat for hours. A start (`since` null, or an `active` report that cannot
  continue an interval) is ignored while the page's last report is an `active`
  one younger than a heartbeat (`startsTooSoon`); after a stop it is always
  stored, so a start, a stop 3 s later and a second start 2 s after that are
  stored as before. The report that ends an interval (`inactive` at the
  deadline, `background` when the page is hidden) is never limited, and an
  interval has one (a second one finds no open interval and is ignored, as
  before). A dropped report changes nothing: the next one is judged against the
  same last report. The state is read from the rows: `lastOfInstance` also gives
  `opened` (the end of the interval's latest start row) and `beats` (the rows
  after it), so a restart changes nothing. A flood of 100 reports in one second
  from one page stores a start and one heartbeat, and a flood of starts one
  row. A start within a heartbeat of an active report (a lost stop followed by a
  new start) is now ignored instead of opening a second interval; the page's
  heartbeats then continue the open interval, so the credit is the same.
* **[V]** The totals: the union of the stored intervals of the account
  intersected with the window (`union`, `activeMs`, `dailyMs`), so two pages
  or devices count a real second once; the day windows are UTC days (an
  interval over midnight is split on read).
* **[V]** Usage sessions (#232 Q1, decided: 30 minutes): the number of the
  player's session, counting from 1: a new one when 30 minutes or more passed
  since the player's last interval, or when the round changed.
* **[V]** An account in vacation mode (#223) records no play time; the page
  also sends nothing while signed out or in vacation mode.
* **[V]** A report is no manual action of #229: it sets no public activity and
  writes no audit entry. The click samples of `POST /api/activity` stay as
  they were for the public markers; they no longer feed the admin estimate.
* **[V]** The admin diagnostics use the same sums (`src/server/game/playtime.ts`,
  `weekMs`, `dayTable`): today and the six preceding UTC days. The old sums of
  `player_activity` (kept 30 days, no longer written) are not added; only the
  admin's „last seen“ still takes the later of them and the new last interaction.
* **[V]** The own view reads `GET /api/own-activity`, the account taken from
  the session, never from the request. It shows today, the last 7 days, the
  running round and all rounds as the estimated active time, a table of the 7
  UTC days with the successful actions of the audit log (kept 30 days),
  „Zuletzt aktiv“ (the end of the last interaction) and „Erfasst seit“ (the
  start of the first recorded interval). The method has a version
  (`METHOD_VERSION`, 1) stored with each interval; the view says that earlier
  estimates were calculated differently and are not included.

# The table (for the archive, #235)

* **[V]** `playtime_events` (migration `20261119T1815-playtime-events`),
  append only, one row per accepted report: `id`, `user_id` (goes with the
  account), `round` (the number of the round, setting `round`),
  `play_session` (per player, from 1), `instance`, `seq` (unique with the
  account and the page), `state` (the state the page moved to), `reason`
  (`start`, `heartbeat`, `idle`, `background`), `start_ms` and `end_ms` (the
  accepted interval on the server's clock, UTC milliseconds) and `method`.
  The active time of a row is `end_ms - start_ms` (a start has none), whatever
  its state; the time of a player in a round is the union of those intervals
  (`union`, `activeMs` in `src/core/playtime.ts`). Nothing else is stored: the
  round's `roundStart` is not on the rows; a round is its number.
* **[V]** The archive (#235): at the close of a round the intervals of every
  participant go into the archive as events (`player.playtime`, see
  [Round archive](/features/round-archive.md)); `playtime_events` keeps its rows
  and the admin's „Runde löschen“ deletes the rows of that round (`deleteRound`
  of `ctx.playtime`), as the retention of #231 and #232 says. The envelope
  fields the owner named for all user-triggered game events (`round_id`,
  `play_session_id` on the audit log) are not built.

# Open

* **[E]** The limit of the reports (owner, 2026-11-19, „Geklärt“ on #232): a
  page (`instance`) stores at most one row per heartbeat interval (30 s, the
  existing constant, no new number); a report that comes faster is dropped, not
  stored and not credited later twice.
* **[E]** The number of reports is bounded by the limit per account of #328
  (owner, 2026-11-19, #232): `POST /api/playtime` and `POST /api/action` share
  one counter of 120 per account and minute, so a script cannot fill the
  table. A report over the limit is refused like an action (HTTP 400,
  „Zu viele Aktionen in kurzer Zeit. Bitte warte einen Moment.“, the same
  audit entry per account and hour); the tracker of the page drops it as it
  drops any lost report and does not retry. The limit sits in the HTTP layer
  (`src/server/http/app.ts`, `action-limit.ts`); the play time code and its
  limit per page are unchanged. An honest page needs about 2 reports a
  minute. The credited time stays bounded by the real time.
* **[U]** Whether the player's own view also shows the legacy sums of the
  first days (#231 allows it „labelled incomplete“); built without.
