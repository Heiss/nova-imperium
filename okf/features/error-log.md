---
type: feature
title: Error log and problem reports
description: Server errors, browser errors and problem reports of players in SQLite, the admin tab „Fehler“ and the download for analysis (issue #126).
---

# Error log and problem reports

Issue #126, milestone `next release` (owner, 2026-11-12). Unexpected server
errors so far only reach the console (Docker logs), browser errors are not
recorded. The owner wants to collect problems of the new release and hand
them to Claude for analysis.

* **[E]** In this release (owner, 2026-11-12).
* **[E]** Server errors: unexpected exceptions (HTTP 500, settling,
  arrivals, background jobs) are stored with time, request ID, action,
  player, message and stack. Expected refusals (`GameError`) are not errors.
* **[E]** Browser errors of signed-in players: JavaScript errors, unhandled
  rejections and failed API calls, with version, page and browser. At most
  20 per minute and 200 per day and player; equal errors are merged with a
  counter. Nothing is recorded on the login page (owner, 2026-11-12).
* **[E]** Problem reports: a form in „Hilfe & Optionen“ (text up to 1,000
  characters), and every error message in the game offers „Problem melden“,
  prefilled with page, version and the last request ID. At most 5 reports
  per player and hour (owner, 2026-11-12).
* **[E]** Admin: a new tab „Fehler“ lists server errors, browser errors and
  problem reports, newest first, with the paging of the event log, and a
  download button (owner, 2026-11-12).
* **[E]** Download: one ZIP built with the library `fflate`, one JSON Lines
  file per kind (errors, problem reports, audit log), time range selectable,
  default 7 days. The download is recorded in the audit log as an admin read
  (owner, 2026-11-12).
* **[E]** Kept 30 days like the audit log. The download contains player
  names; never passwords, session or invitation tokens, email login codes,
  email addresses or raw request bodies (owner, 2026-11-12).
* **[V]** Storage: one table `error_events` (kind `server`, `client`,
  `report`) with an append-only migration and an upgrade test; the client
  endpoint and its limits count as security files (mutation 90 %).
* **[V]** German labels: tab „Fehler“, button „Herunterladen“, form
  „Problem melden“ with „Was ist passiert?“ and „Absenden“, answer
  „Danke, die Meldung ist angekommen.“
* **[E]** A failed API call is an answer of 500 or more outside maintenance,
  or a call without an answer. Refusals (400) and „Bitte einloggen“ (401) are
  expected and not recorded (owner, 2026-11-12).
* **[E]** Equal browser errors are merged per player and UTC day: the
  counter rises and the time moves to the last occurrence; the first stays.
  The list orders by the first record, newest first, so paging stays stable
  (owner, 2026-11-12).
* **[E]** Limits are fixed windows per player in the server's memory (like
  the login limit) and start again after a restart. Over the limit a browser
  error gets 429 and is dropped; a report gets „Zu viele Meldungen – bitte
  in einer Stunde nochmal.“ A call refused by the minute does not count for
  the day, an empty report does not count (owner, 2026-11-12).
* **[E]** Field limits: message 500, stack 4,000, page 40, version 20,
  browser 200, action 80 characters; report text 1,000 (owner, 2026-11-12).
* **[E]** Scrubbing (`scrub` in `src/server/error-log.ts`) before storing,
  on every text including the report: the value after a name that hints at
  a secret (`password`, `passwort`, `passwd`, `pw`, `kennwort`, `token`,
  `secret`, `session`, `cookie`, `salt`, `hash`, `code`, `challenge`,
  `auth`, `email`; `pw`, `passwd` and `kennwort` added after the review of
  #128), email addresses, tokens (a run of 32 or more letters, digits, `-`
  and `_`, or of 20 or more with both digits and letters; request IDs stay)
  and six-digit numbers (login codes, also before a colon; not stack
  positions, which follow a colon). Server errors keep only name, message
  and stack of the exception; request bodies, headers and queries are never
  read into the log (owner, 2026-11-12).
* **[E]** Deleting an account deletes its errors and reports (foreign key
  `ON DELETE CASCADE`), like its audit entries (owner, 2026-11-12).
* **[V]** Version: the browser sends the version it loaded with
  „Neuigkeiten“; without one, and for server errors, the running version.
* **[V]** Background jobs recorded: the game clock and fleet arrivals
  (`tick`, `arrival`), the hourly cleanup (`sweep`, which so far was not
  caught at all), Web Push delivery (`push`) and the password reset mail
  (`mail`). Settling runs inside requests and is covered by their 500.
* **[V]** Further labels: box „Problem melden“ in „Hilfe & Optionen“; the
  line „Seite: … · Version: … · Letzter Vorgang: … · Meldung: …“ above the
  text; in the tab „Fehler“ the filter „Art“ (Alle, Serverfehler,
  Browserfehler, Problemmeldungen), „Anzahl je Seite“, „Zeitraum von“ and
  „bis“. An error message with the offer stays 8 seconds instead of 3.5
  ([E] for the 8 seconds, owner, 2026-11-12).
* **[E]** The download is a POST with JSON like every other admin call
  (cross-site protection), not a link; the list of the tab is audited as
  the admin read `errors`, the download as `errorDownload` with range and
  counts (owner, 2026-11-12).
* **[V]** „Default 7 days“ in the tab means 7 calendar days: „Zeitraum von“
  is six days before today, „bis“ is today, each day whole (from 00:00 of
  the first to the end of the last day, local time). A request without a
  range takes the 7 × 24 hours before now; an explicit 0 counts as a value
  (review of #128).
* **[V]** A lost session (401) during the download goes back to the login
  like every other call; a failure of an outdated list request is not
  shown; a late answer to a report closes its dialog only if it is still
  open (review of #128).

# Code, interface and tests

* Storage: table `error_events` of migration 12 (kind, time of the last and
  `first` occurrence, player, request ID, action, page, version, browser,
  message, detail, count, report), see [SQLite storage](/data/sqlite.md).
  `purgeAudit` in `src/server/audit.ts` deletes it after 30 days in the
  hourly cleanup.
* Server: `src/server/error-log.ts` scrubs, limits and stores; `fault` in
  `src/server/http/app.ts` records every 500 with route, request ID and the
  player of the session; `jobFailure` in `src/server/server.ts` wraps the
  background jobs. The console lines stay as they were; a failing write is
  logged as „Error log write failed“ and never thrown.
* Endpoints: `POST /api/errors` and `POST /api/report` for signed-in
  players (`src/server/http/errors.ts`, limits with `RateLimiter`);
  `POST /api/admin/errors` (page) and `POST /api/admin/errors/download`
  (ZIP, `src/server/error-export.ts`: `errors.jsonl` with server and browser
  errors, `reports.jsonl`, `audit.jsonl`, filtered by the time of the last
  occurrence) for admins only. Limits and kinds are shared in
  `src/core/error-log.ts`.
* Browser: `src/client/logic/error-report.ts` (reporter, form); `main.ts`
  listens to `error` and `unhandledrejection`, reports failed calls from
  `api()` and sends with a plain `fetch`, so a failed report is never
  reported again; nothing is sent while nobody is signed in. The tab
  „Fehler“ is `src/client/views/admin-errors.ts` with the pager of the event
  log.
* Tests: `src/server/error-log.test.ts` (scrubbing, limits of the fields,
  merging, list, retention, account deletion), `error-export.test.ts`
  (unzipped JSON lines), `http/errors.test.ts` (sign-in, 20/200 and 5 per
  hour, 500 without body, admin only, download audited),
  `server.test.ts` (background jobs), `upgrades/migration-12.test.ts`,
  `src/client/logic/error-report.test.ts`; E2E `e2e/error-log.spec.ts`
  (form, toast offer, tab, paging, download, desktop and phone) and axe in
  `e2e/a11y.spec.ts`. Security files with a 90 % mutation target:
  `error-log.ts`, `error-export.ts`, `http/errors.ts`.
